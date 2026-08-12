// POST /api/turn — 확정 텍스트 → 캐릭터 응답 1턴 (T032, contracts/api-routes.md)
// ①메시지 저장 → ②분석 → ③후처리 → ④분석 저장 → ⑤규칙 판정 → ⑥생성 또는 고정 대사 →
// ⑦TTS(캐시) → ⑧세션 갱신. 분석·생성은 1회 재시도, TTS 실패는 텍스트만 반환(폴백 매트릭스).
// CLOSING은 LLM·TTS 미호출 — fixed-audio 사전 생성 mp3 URL 반환 (R-04, 장애와 무관하게 성공).
import { substituteChildName } from '@/lib/child-name';
import { fixedAudioUrl } from '@/lib/fixed-audio';
import { ANALYSIS_VERSION, analyzeUtterance } from '@/lib/llm/analysis';
import { generateReply, loadCharacter } from '@/lib/llm/generate';
import { postprocessAnalysis } from '@/lib/llm/postprocess';
import { missionForScene } from '@/lib/missions';
import { evaluateTurn, type RuleState } from '@/lib/rules/engine';
import { evaluateMissionExposure, type MissionPhase } from '@/lib/rules/mission';
import { containsInappropriateLanguage } from '@/lib/safety';
import { rules as ruleThresholds } from '@/lib/config';
import type { ThinkingElement } from '@/lib/contracts';
import { fixtureSceneByUuid } from '@/lib/story';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';
import { synthesizeWithCache, voiceForRole } from '@/lib/tts';

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

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) return errorJson(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');

  let body: { sessionId?: string; sceneId?: string; text?: string; sttRawText?: string; isMission?: boolean };
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'BAD_REQUEST', '요청 본문이 JSON이 아닙니다.');
  }
  const { sessionId, sceneId, text, sttRawText, isMission } = body;
  if (!sessionId || !sceneId || !text?.trim()) {
    return errorJson(400, 'BAD_REQUEST', 'sessionId·sceneId·text는 필수입니다.');
  }
  // isMission=true — 미션 팝업 응답 제출. 메시지·분석은 일반 턴과 동일 경로(요소 확인 활용, 정답 판정 아님)

  const admin = getSupabaseAdmin();

  const { data: session } = await admin
    .from('story_sessions')
    .select(
      'id, story_id, child_id, current_scene_id, current_child_turn_count, accumulated_elements, turns_without_new_element, consecutive_low_information_turns, scene_goal_met, mission_phase',
    )
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) return errorJson(400, 'BAD_REQUEST', '세션을 찾을 수 없습니다.');

  // 실명 호출 (R-07 확정) — 히스토리 치환·생성 프롬프트 호칭에 사용
  const { data: childRow } = await admin
    .from('children')
    .select('name')
    .eq('id', session.child_id)
    .maybeSingle();
  const childName = childRow?.name ?? undefined;

  const { data: sceneRow } = await admin
    .from('story_scenes')
    .select('id, story_id, scene_order, character_name, character_closing, scene_goal, required_elements, max_turns')
    .eq('id', sceneId)
    .maybeSingle();
  if (!sceneRow || sceneRow.story_id !== session.story_id) {
    return errorJson(400, 'BAD_REQUEST', '장면이 세션의 이야기와 일치하지 않습니다.');
  }
  // 장면 유형은 fixtures 매핑에서 파생 (DB에 scene_type 없음 — Notion 설계서 SoT)
  const fixture = fixtureSceneByUuid(sceneId);
  if (fixture ? fixture.type !== 'dialogue' : !sceneRow.character_name) {
    return errorJson(400, 'BAD_REQUEST', '대화 장면이 아닙니다.');
  }

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
    substituteChildName(fixture?.character_opening ?? '', childName);

  // ① 아이 메시지 저장 — 게이트 실패 발화는 클라이언트가 보내지 않는다(계약 불변 조건 1)
  const { data: childMessage, error: messageError } = await admin
    .from('messages')
    .insert({
      // id·created_at은 스키마 기본값 없음 (Notion 설계서 원형) — 클라이언트 생성
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
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
    id: crypto.randomUUID(), // 스키마 기본값 없음 — 클라이언트 생성
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

  // ⑤-2 미션 판정 (T041, 기능명세서 2.4.3 ⑥) — 노출은 장면당 1회(mission_phase, 002 마이그레이션)
  const mission = fixture ? missionForScene(fixture.external_id) : null;
  let missionPhase: MissionPhase = isNewScene ? null : ((session.mission_phase ?? null) as MissionPhase);
  if (isMission && missionPhase === 'exposed') missionPhase = 'completed'; // 미션 응답 제출 — 팝업 [성공 완료] 전환

  // 미션 필수 장면 가드: 미션 미수행 GOAL_MET 조기 종료는 보류하고 대화를 연다
  // (기획 흐름 — 미션 수행→부족 요소 질문→종료. MAX_TURNS는 하드 리밋이라 보류 없음)
  let effectiveDecision = decision;
  if (decision.mode === 'CLOSING' && decision.sceneEndReason === 'GOAL_MET' && mission && missionPhase !== 'completed') {
    effectiveDecision = { mode: 'NORMAL', missingElements: decision.missingElements };
  }

  // 장면이 끝나는 턴에는 노출하지 않는다 (팝업 띄울 다음 사이클이 없음)
  const exposure =
    effectiveDecision.mode === 'CLOSING'
      ? { expose: false as const, reason: null }
      : evaluateMissionExposure({
          mission,
          missionPhase,
          turnCount: nextState.turnCount,
          detectedElements: refined.detectedElements.map((element) => element.type),
          accumulated: nextState.accumulated,
          utteranceValidity: refined.utteranceValidity,
          consecutiveLowInformationTurns: nextState.consecutiveLowInformationTurns,
        });
  if (exposure.expose) missionPhase = 'exposed';

  // ⑥ 노출 턴: 캐릭터 응답 없이 팝업만 (기능명세서 — 캐릭터 음성 재생 없이 화면 표시, 바로 답 대기)
  //    CLOSING: LLM 미호출, 고정 클로징 (R-04) / NORMAL·GUIDED: 캐릭터 생성 (1회 재시도)
  let characterReplyText: string;
  let audioUrl: string | null = null;
  if (exposure.expose) {
    characterReplyText = '';
  } else if (effectiveDecision.mode === 'CLOSING') {
    characterReplyText = sceneRow.character_closing ?? '';
    audioUrl = fixture ? fixedAudioUrl(`${fixture.external_id}__closing`) : null;
  } else {
    // 입력측 부적절·주제 이탈 발화 (T075, E2E 항목 24) — 차단 없이 캐릭터가 따라 말하지 않고 주제 복귀
    const redirect = containsInappropriateLanguage(text)
      ? ('INAPPROPRIATE' as const)
      : refined.utteranceValidity === 'OFF_TOPIC'
        ? ('OFF_TOPIC' as const)
        : undefined;
    try {
      characterReplyText = await withRetry(() =>
        generateReply({
          character,
          sceneGoal: sceneRow.scene_goal ?? '',
          mode: effectiveDecision.mode as 'NORMAL' | 'GUIDED',
          guidanceTarget: effectiveDecision.guidanceTarget,
          missingElements: effectiveDecision.missingElements,
          redirect,
          childName,
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
    // T019 확정으로 동적 조회 → 정적 voice-map 로더 교체 (미확정 시기의 파일 부재 폴백 제거)
    try {
      const voice = voiceForRole(sceneRow.character_name);
      const synthesis = await synthesizeWithCache(characterReplyText, voice.voice_id, {
        model: voice.model,
        storage: admin,
      });
      audioUrl = synthesis.url ?? null;
    } catch (error) {
      console.warn(`[turn] TTS 실패 — 텍스트만 반환: ${error instanceof Error ? error.message : error}`);
    }
  }

  // 캐릭터 메시지 저장 (CLOSING 고정 대사 포함 — Notion §8: 서버가 closing을 messages에 저장)
  // 미션 노출 턴은 캐릭터 발화가 없어 저장하지 않는다
  if (characterReplyText) {
    await admin.from('messages').insert({
      id: crypto.randomUUID(), // 스키마 기본값 없음 — 클라이언트 생성
      created_at: new Date().toISOString(),
      session_id: sessionId,
      scene_id: sceneId,
      speaker_type: 'character',
      turn_order: nextTurnOrder + 1,
      text: characterReplyText,
    });
  }

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
      last_response_mode: effectiveDecision.mode,
      last_guidance_target: effectiveDecision.guidanceTarget ?? null,
      turns_without_new_element: nextState.turnsWithoutNewElement,
      consecutive_low_information_turns: nextState.consecutiveLowInformationTurns,
      scene_goal_met: effectiveDecision.mode === 'CLOSING',
      scene_end_reason: effectiveDecision.sceneEndReason ?? null,
      mission_phase: missionPhase,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
  if (sessionError) {
    return errorJson(502, 'DB_ERROR', `세션 갱신 실패: ${sessionError.message}`);
  }

  return Response.json({
    mode: effectiveDecision.mode,
    characterReplyText,
    audioUrl,
    // 미션 분기 (T041) — 노출은 이 필드로만 전달(클라이언트 판정 금지), missionPhase는 팝업 단계 표기
    ...(exposure.expose && mission ? { exposeMission: mission.id, missionPhase: 'progress' as const } : {}),
    ...(isMission && missionPhase === 'completed' ? { missionPhase: 'success' as const } : {}),
    ...(effectiveDecision.mode === 'CLOSING'
      ? {
          sceneEnd: {
            reason: effectiveDecision.sceneEndReason,
            nextSceneId: nextScene?.id ?? null,
          },
        }
      : {}),
    progress: {
      accumulated: nextState.accumulated,
      missing: effectiveDecision.missingElements,
      turn: nextState.turnCount,
      maxTurns: sceneRow.max_turns ?? 0,
    },
  });
}
