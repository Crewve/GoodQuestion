// POST /api/sessions — 세션 시작/재개 (T031, contracts/api-routes.md)
// 재개 지점: scene_goal_met=true면 현재 장면 +1, 아니면 현재 장면(도입 미완은 항상 처음 — FR-017).
// 진행률 n/N: 전개+대화 쌍=1(도입 제외) — 이 이야기에서는 완료된 대화 장면 수 / 대화 장면 수.
// 장면 유형(도입/전개/대화)은 DB 컬럼이 아니라 fixtures 매핑에서 파생한다 (Notion 설계서 SoT — 스키마 무변경).
import { characterImageUrl, sceneImageUrl } from '@/lib/assets';
import { fixedAudioUrl } from '@/lib/fixed-audio';
import { loadCharacter } from '@/lib/llm/generate';
import { fixtureSceneByUuid, sceneTypeOf } from '@/lib/story';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';

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
    .select('id, parent_id')
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
      // 도입/전개는 내레이션 사전 생성본, 대화는 오프닝 고정 대사 (R-06 키 규칙)
      openingAudioUrl: externalId
        ? fixedAudioUrl(`${externalId}__${isDialogue ? 'opening' : 'narration'}`)
        : undefined,
      imageUrl: externalId ? sceneImageUrl(externalId) : undefined,
    };
  });

  // 진행률 — N=대화 장면 수(전개+대화 쌍), n=재개 지점 이전에 완료된 대화 수
  const dialogueOrders = scenes.filter((s) => sceneTypeForRow(s) === '대화').map((s) => s.scene_order);
  const N = dialogueOrders.length;
  const n = dialogueOrders.filter((order) => order < resumeSceneOrder).length;

  return Response.json({
    sessionId: session.id,
    resumeSceneId: resumeScene?.id ?? null,
    resumeSceneOrder: Math.min(resumeSceneOrder, lastOrder + 1),
    scenes: scenesPayload,
    progress: { n, N, percent: N === 0 ? 0 : Math.round((n / N) * 100) },
  });
}
