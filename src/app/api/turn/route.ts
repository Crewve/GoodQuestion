// POST /api/turn — 확정 텍스트 → 캐릭터 응답 1턴 (T032, contracts/api-routes.md)
// ①메시지 저장 → ②분석 → ③후처리 → ④분석 저장 → ⑤규칙 판정 → ⑥생성 또는 고정 대사 →
// ⑦TTS(캐시) → ⑧세션 갱신. 분석·생성은 1회 재시도, TTS 실패는 텍스트만 반환(폴백 매트릭스).
// CLOSING은 LLM·TTS 미호출 — fixed-audio 사전 생성 mp3 URL 반환 (R-04, 장애와 무관하게 성공).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixedAudioUrl } from '@/lib/fixed-audio';
import { ANALYSIS_VERSION, analyzeUtterance } from '@/lib/llm/analysis';
import { generateReply, loadCharacter } from '@/lib/llm/generate';
import { postprocessAnalysis } from '@/lib/llm/postprocess';
import { evaluateTurn, type RuleState } from '@/lib/rules/engine';
import { rules as ruleThresholds } from '@/lib/config';
import type { ThinkingElement } from '@/lib/contracts';
import { fixtureSceneByUuid } from '@/lib/story';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';
import { synthesizeWithCache } from '@/lib/tts';

function errorJson(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/** 폴백 매트릭스: LLM 장애 1회 자동 재시도 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    return await fn();
  }
}

/**
 * 보이스 매핑 조회 — voice-map.json은 파트1 T019 산출물(투표 후 확정)이라 아직 없을 수 있다.
 * 없으면 null을 반환하고 TTS를 건너뛴다(텍스트만 표시 폴백). T019 확정 후 정적 import로 교체 예정.
 */
function loadVoiceId(voiceRole: string): string | null {
  try {
    const mapPath = resolve(process.cwd(), 'src/lib/tts/voice-map.json');
    if (!existsSync(mapPath)) return null;
    const voiceMap = JSON.parse(readFileSync(mapPath, 'utf8')) as Record<string, string>;
    return voiceMap[voiceRole] ?? voiceMap[voiceRole.replace('ch_banggui_', '')] ?? null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) return errorJson(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');

  let body: { sessionId?: string; sceneId?: string; text?: string; sttRawText?: string; isMission?: boolean };
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'BAD_REQUEST', '요청 본문이 JSON이 아닙니다.');
  }
  const { sessionId, sceneId, text, sttRawText } = body;
  if (!sessionId || !sceneId || !text?.trim()) {
    return errorJson(400, 'BAD_REQUEST', 'sessionId·sceneId·text는 필수입니다.');
  }
  // isMission 분기는 T041(US2)에서 확장 — 현재는 일반 턴과 동일 경로

  const admin = getSupabaseAdmin();

  const { data: session } = await admin
    .from('story_sessions')
    .select(
      'id, story_id, current_scene_id, current_child_turn_count, accumulated_elements, turns_without_new_element, consecutive_low_information_turns, scene_goal_met',
    )
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return errorJson(400, 'BAD_REQUEST', '세션을 찾을 수 없습니다.');

  const { data: sceneRow } = await admin
    .from('story_scenes')
    .select('id, story_id, scene_order, scene_type, character_name, character_closing, scene_goal, required_elements, max_turns')
    .eq('id', sceneId)
    .maybeSingle();
  if (!sceneRow || sceneRow.story_id !== session.story_id) {
    return errorJson(400, 'BAD_REQUEST', '장면이 세션의 이야기와 일치하지 않습니다.');
  }
  if (sceneRow.scene_type !== '대화') {
    return errorJson(400, 'BAD_REQUEST', '대화 장면이 아닙니다.');
  }

  const fixture = fixtureSceneByUuid(sceneId);
  const character = loadCharacter(sceneRow.character_name);

  // 장면 전환 감지 — 새 장면 진입 시 규칙 상태 리셋 (누적 요소는 장면 단위)
  const isNewScene = session.current_scene_id !== sceneId || session.scene_goal_met;
  const state: RuleState = isNewScene
    ? { turnCount: 0, accumulated: [], turnsWithoutNewElement: 0, consecutiveLowInformationTurns: 0 }
    : {
        turnCount: session.current_child_turn_count ?? 0,
        accumulated: (session.accumulated_elements ?? []) as ThinkingElement[],
        turnsWithoutNewElement: session.turns_without_new_element ?? 0,
        consecutiveLowInformationTurns: session.consecutive_low_information_turns ?? 0,
      };

  // 이번 장면 대화 내역 (생성 프롬프트·분석 맥락용)
  const { data: history } = await admin
    .from('messages')
    .select('speaker_type, text, turn_order')
    .eq('session_id', sessionId)
    .eq('scene_id', sceneId)
    .order('turn_order');
  const nextTurnOrder = (history?.at(-1)?.turn_order ?? 0) + 1;
  const lastCharacterText =
    history?.filter((m) => m.speaker_type === 'character').at(-1)?.text ??
    (fixture?.character_opening ?? '').replaceAll('ㅇㅇ', '친구야');

  // ① 아이 메시지 저장 — 게이트 실패 발화는 클라이언트가 보내지 않는다(계약 불변 조건 1)
  const { data: childMessage, error: messageError } = await admin
    .from('messages')
    .insert({
      session_id: sessionId,
      scene_id: sceneId,
      speaker_type: 'child',
      turn_order: nextTurnOrder,
      text: text.trim(),
      stt_raw_text: sttRawText ?? null,
    })
    .select('id')
    .single();
  if (messageError || !childMessage) {
    return errorJson(502, 'DB_ERROR', `메시지 저장 실패: ${messageError?.message}`);
  }

  // ② 분석 (1회 재시도) → ③ 후처리
  let raw;
  try {
    raw = await withRetry(() =>
      analyzeUtterance(text.trim(), {
        sceneGoal: sceneRow.scene_goal ?? '',
        characterName: character.name,
        characterQuestion: lastCharacterText,
        requiredElements: (sceneRow.required_elements ?? []) as ThinkingElement[],
      }),
    );
  } catch (error) {
    return errorJson(502, 'ANALYSIS_FAILED', `분석 LLM 장애: ${error instanceof Error ? error.message : error}`);
  }
  const { refined, dropped, correctedCount } = postprocessAnalysis(text.trim(), raw);
  // LLM 원본은 서버 로그로 보존 (R-11-4 — raw 컬럼 협의 전까지)
  console.log(
    `[turn] analysis raw session=${sessionId} message=${childMessage.id} raw=${JSON.stringify(raw)} dropped=${JSON.stringify(dropped)} corrected=${correctedCount}`,
  );

  // ④ 분석 확정본 저장
  const { error: analysisError } = await admin.from('utterance_analyses').insert({
    message_id: childMessage.id,
    child_intent: refined.childIntent,
    main_point: refined.mainPoint,
    detected_elements: refined.detectedElements,
    utterance_validity: refined.utteranceValidity,
    analysis_version: ANALYSIS_VERSION,
  });
  if (analysisError) {
    return errorJson(502, 'DB_ERROR', `분석 저장 실패: ${analysisError.message}`);
  }

  // ⑤ 규칙 판정 (순수 코드 — LLM 무관)
  const { decision, nextState } = evaluateTurn(
    state,
    {
      requiredElements: (sceneRow.required_elements ?? []) as ThinkingElement[],
      maxTurns: sceneRow.max_turns ?? 0,
    },
    refined,
    ruleThresholds,
  );

  // ⑥ CLOSING: LLM 미호출, 고정 클로징 (R-04) / NORMAL·GUIDED: 캐릭터 생성 (1회 재시도)
  let characterReplyText: string;
  let audioUrl: string | null = null;
  if (decision.mode === 'CLOSING') {
    characterReplyText = sceneRow.character_closing ?? '';
    audioUrl = fixture ? fixedAudioUrl(`${fixture.external_id}__closing`) : null;
  } else {
    try {
      characterReplyText = await withRetry(() =>
        generateReply({
          character,
          sceneGoal: sceneRow.scene_goal ?? '',
          mode: decision.mode as 'NORMAL' | 'GUIDED',
          guidanceTarget: decision.guidanceTarget,
          missingElements: decision.missingElements,
          history: [
            ...(history ?? []).map((m) => ({
              speaker: (m.speaker_type === 'character' ? 'character' : 'child') as 'character' | 'child',
              text: m.text,
            })),
            { speaker: 'child' as const, text: text.trim() },
          ],
        }),
      );
    } catch (error) {
      return errorJson(502, 'GENERATION_FAILED', `캐릭터 생성 장애: ${error instanceof Error ? error.message : error}`);
    }

    // ⑦ TTS 2층 캐시 — 실패해도 턴은 성공 (텍스트만 표시 폴백)
    const voiceId = loadVoiceId(sceneRow.character_name);
    if (voiceId) {
      try {
        const synthesis = await synthesizeWithCache(characterReplyText, voiceId, { storage: admin });
        audioUrl = synthesis.url ?? null;
      } catch (error) {
        console.warn(`[turn] TTS 실패 — 텍스트만 반환: ${error instanceof Error ? error.message : error}`);
      }
    } else {
      console.warn('[turn] voice-map.json 미확정(T019 대기) — 텍스트만 반환');
    }
  }

  // 캐릭터 메시지 저장 (CLOSING 고정 대사 포함 — Notion §8: 서버가 closing을 messages에 저장)
  await admin.from('messages').insert({
    session_id: sessionId,
    scene_id: sceneId,
    speaker_type: 'character',
    turn_order: nextTurnOrder + 1,
    text: characterReplyText,
  });

  // 다음 장면 (CLOSING 시 이동 대상)
  const { data: nextScene } = await admin
    .from('story_scenes')
    .select('id')
    .eq('story_id', session.story_id)
    .eq('scene_order', sceneRow.scene_order + 1)
    .maybeSingle();

  // ⑧ 세션 상태 갱신 (camelCase→snake_case는 이 저장 경계에서만)
  const { error: sessionError } = await admin
    .from('story_sessions')
    .update({
      current_scene_id: sceneId,
      current_child_turn_count: nextState.turnCount,
      accumulated_elements: nextState.accumulated,
      last_detected_elements: refined.detectedElements.map((element) => element.type),
      last_response_mode: decision.mode,
      last_guidance_target: decision.guidanceTarget ?? null,
      turns_without_new_element: nextState.turnsWithoutNewElement,
      consecutive_low_information_turns: nextState.consecutiveLowInformationTurns,
      scene_goal_met: decision.mode === 'CLOSING',
      scene_end_reason: decision.sceneEndReason ?? null,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
  if (sessionError) {
    return errorJson(502, 'DB_ERROR', `세션 갱신 실패: ${sessionError.message}`);
  }

  return Response.json({
    mode: decision.mode,
    characterReplyText,
    audioUrl,
    ...(decision.mode === 'CLOSING'
      ? {
          sceneEnd: {
            reason: decision.sceneEndReason,
            nextSceneId: nextScene?.id ?? null,
          },
        }
      : {}),
    progress: {
      accumulated: nextState.accumulated,
      missing: decision.missingElements,
      turn: nextState.turnCount,
      maxTurns: sceneRow.max_turns ?? 0,
    },
  });
}
