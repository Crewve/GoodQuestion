// POST /api/sessions — 세션 시작/재개 (T031, contracts/api-routes.md)
// 재개 지점: scene_goal_met=true면 현재 장면 +1, 아니면 현재 장면(도입 미완은 항상 처음 — FR-017).
// 진행률 n/N: 도입 포함 5분할(2026-08-14 정정) — N=도입(1)+전개·대화 쌍 수, 도입=1, 전개k·대화k=k+1.
// 장면 유형(도입/전개/대화)은 DB 컬럼이 아니라 fixtures 매핑에서 파생한다 (Notion 설계서 SoT — 스키마 무변경).
import { characterImageUrl, sceneImageUrl } from '@/lib/assets';
import { substituteChildName } from '@/lib/child-name';
import { givenName } from '@/lib/profile-display';
import { fixedAudioUrl } from '@/lib/fixed-audio';
import { loadCharacter } from '@/lib/llm/generate';
import { fixtureSceneByUuid, sceneTypeOf } from '@/lib/story';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';
import { synthesizeWithCache, voiceForRole } from '@/lib/tts';

type SceneRow = {
  id: string;
  scene_order: number;
  scene_description: string;
  character_name: string;
};

/** 장면 유형 — fixtures 우선, 매핑이 없으면 DB 값으로 근사(대화=character_name 존재) */
function sceneTypeForRow(row: SceneRow): '도입' | '전개' | '대화' {
  const fixture = fixtureSceneByUuid(row.id);
  if (fixture) return sceneTypeOf(fixture);
  if (row.character_name) return '대화';
  return row.scene_order === 1 ? '도입' : '전개';
}

function errorJson(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/** 시간 예산 초과 시 null — 원 프라미스는 계속 진행돼 캐시를 채운다 (다음 진입 시 히트) */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * R-07 확정(실명 호출): 'ㅇㅇ' 자리표시자 오프닝은 아이 이름 치환본을 런타임 TTS로 준비.
 * 캐시(hash(voiceId+text)) 덕에 아이당 최초 1회만 합성. 예산 내 준비 실패 시 '친구야' 사전 생성본 폴백.
 */
async function personalizedOpeningUrls(
  scenes: SceneRow[],
  childName: string,
  storage: ReturnType<typeof getSupabaseAdmin>,
): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  await Promise.all(
    scenes.map(async (scene) => {
      const opening = fixtureSceneByUuid(scene.id)?.character_opening;
      if (!opening?.includes('ㅇㅇ')) return;
      try {
        const voice = voiceForRole(scene.character_name);
        const text = substituteChildName(opening, childName);
        const synthesis = await withTimeout(
          synthesizeWithCache(text, voice.voice_id, { model: voice.model, storage }),
          3_500,
        );
        if (synthesis?.url) urls.set(scene.id, synthesis.url);
      } catch (error) {
        console.warn(`[sessions] 실명 오프닝 준비 실패(${scene.id}) — 고정본 폴백: ${error instanceof Error ? error.message : error}`);
      }
    }),
  );
  return urls;
}

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) return errorJson(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');

  let body: { childId?: string; storyId?: string };
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'BAD_REQUEST', '요청 본문이 JSON이 아닙니다.');
  }
  const { childId, storyId } = body;
  if (!childId || !storyId) {
    return errorJson(400, 'BAD_REQUEST', 'childId와 storyId는 필수입니다.');
  }

  const admin = getSupabaseAdmin();

  // 아이가 로그인한 보호자 소속인지 확인
  const { data: child } = await admin
    .from('children')
    .select('id, parent_id, name, avatar_key')
    .eq('id', childId)
    .maybeSingle();
  if (!child || child.parent_id !== user.id) {
    return errorJson(400, 'BAD_REQUEST', '해당 보호자의 아이가 아닙니다.');
  }

  const { data: scenes, error: scenesError } = await admin
    .from('story_scenes')
    .select('id, scene_order, scene_description, character_name')
    .eq('story_id', storyId)
    .order('scene_order')
    .returns<SceneRow[]>();
  if (scenesError || !scenes || scenes.length === 0) {
    return errorJson(400, 'BAD_REQUEST', '이야기 장면을 찾을 수 없습니다 (시드 여부 확인).');
  }

  // 진행 중 세션 조회 또는 생성
  let { data: session } = await admin
    .from('story_sessions')
    .select('id, current_scene_id, scene_goal_met')
    .eq('child_id', childId)
    .eq('story_id', storyId)
    .neq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    const { data: created, error: createError } = await admin
      .from('story_sessions')
      .insert({
        // id·타임스탬프는 스키마 기본값 없음 (Notion 설계서 원형) — 클라이언트 생성
        id: crypto.randomUUID(),
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        child_id: childId,
        story_id: storyId,
        status: 'in_progress',
        current_scene_id: scenes[0].id,
        current_child_turn_count: 0,
        accumulated_elements: [],
        last_detected_elements: [],
        turns_without_new_element: 0,
        consecutive_low_information_turns: 0,
        scene_goal_met: false,
      })
      .select('id, current_scene_id, scene_goal_met')
      .single();
    if (createError || !created) {
      return errorJson(502, 'DB_ERROR', `세션 생성 실패: ${createError?.message}`);
    }
    session = created;
  } else {
    await admin
      .from('story_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', session.id);
  }

  // 재개 지점 계산
  const lastOrder = scenes[scenes.length - 1].scene_order;
  const currentScene = scenes.find((scene) => scene.id === session.current_scene_id);
  let resumeSceneOrder: number;
  if (!currentScene) {
    resumeSceneOrder = 1; // 이례 상태 — 도입부터
  } else if (session.scene_goal_met) {
    resumeSceneOrder = currentScene.scene_order + 1; // 장면 완료 → 다음 장면
  } else if (sceneTypeForRow(currentScene) === '도입') {
    resumeSceneOrder = 1; // 도입 중단은 저장하지 않고 항상 처음부터 (FR-017)
  } else {
    resumeSceneOrder = currentScene.scene_order;
  }
  // 마지막 장면까지 완료 → 학습완료(후속 활동) 단계: resumeSceneId=null
  const resumeScene = resumeSceneOrder > lastOrder ? null : scenes.find((s) => s.scene_order === resumeSceneOrder) ?? null;

  // 실명 치환 오프닝 URL (R-07 확정) — 준비 실패 장면은 아래에서 '친구야' 고정본 폴백
  // 호칭은 성 제외 이름 기준 (R-07 보완 2026-08-13 — '정진욱아'가 아니라 '진욱아')
  const callName = child.name ? givenName(child.name) : null;
  const personalizedUrls = callName
    ? await personalizedOpeningUrls(scenes, callName, admin)
    : new Map<string, string>();

  // scenes 페이로드 — 유형·이미지·고정 오디오 URL은 fixtures 매핑(external_id) 기준
  const scenesPayload = scenes.map((scene) => {
    const fixture = fixtureSceneByUuid(scene.id);
    const externalId = fixture?.external_id;
    const sceneType = sceneTypeForRow(scene);
    const isDialogue = sceneType === '대화';
    return {
      id: scene.id,
      order: scene.scene_order,
      type: sceneType,
      description: isDialogue ? undefined : scene.scene_description,
      characterName: isDialogue && scene.character_name ? loadCharacter(scene.character_name).name : undefined,
      characterImageUrl: isDialogue && scene.character_name ? characterImageUrl(scene.character_name) : undefined,
      // 오프닝 표시 텍스트 — 아래에서 반환하는 오디오와 항상 일치(실명본이면 실명, 폴백이면 '친구' 표기)
      openingText: isDialogue
        ? substituteChildName(
            fixture?.character_opening ?? '',
            personalizedUrls.has(scene.id) ? callName : undefined,
          ) || undefined
        : undefined,
      // 도입/전개는 내레이션 사전 생성본, 대화는 오프닝 대사 — 실명본 우선, 없으면 고정본 (R-06·R-07)
      openingAudioUrl:
        personalizedUrls.get(scene.id) ??
        (externalId ? fixedAudioUrl(`${externalId}__${isDialogue ? 'opening' : 'narration'}`) : undefined),
      imageUrl: externalId ? sceneImageUrl(externalId) : undefined,
    };
  });

  // 진행률 — 도입 포함 5분할(2026-08-14 정정): N=도입(1)+전개·대화 쌍 수, 도입=1, 전개k·대화k=k+1.
  // play 헤더(play/[sessionId]/page.tsx currentStep)와 반드시 같은 정의여야 홈 이어하기 카드와
  // 진행 화면 표기가 일치한다. 장면 전부 완료(후속 활동 단계, resumeScene=null)는 n=N.
  const N = scenes.filter((s) => sceneTypeForRow(s) === '대화').length + 1;
  const n = !resumeScene
    ? N
    : sceneTypeForRow(resumeScene) === '도입'
      ? 1
      : 1 +
        Math.max(
          1,
          scenes.filter((s) => sceneTypeForRow(s) === '전개' && s.scene_order <= resumeScene.scene_order).length,
        );

  return Response.json({
    sessionId: session.id,
    childName: callName, // 성 제외 이름 — 클라이언트 치환 폴백도 동일 표기 (R-07 보완)
    childAvatarKey: (child.avatar_key as string | null) ?? null,
    resumeSceneId: resumeScene?.id ?? null,
    resumeSceneOrder: Math.min(resumeSceneOrder, lastOrder + 1),
    scenes: scenesPayload,
    progress: { n, N, percent: N === 0 ? 0 : Math.round((n / N) * 100) },
  });
}
