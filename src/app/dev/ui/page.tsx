// 개발 전용 UI 리허설 갤러리 (/dev/ui) — 세션 진행 없이 이야기 진행·활동 화면을 상태별로 즉시 확인.
// 실제 라우트 화면(홈·목록·상세·인증·마이페이지 계열)은 iframe 미리보기용 컨텍스트(아이·완료 세션)를
// 서버에서 조회해 내린다. 실서비스(Vercel production) 배포에서만 존재하지 않는 라우트로 취급하고(404),
// 로컬·스테이징(preview)에서는 접근을 허용한다.
// 스테이징이 production 타깃으로 배포되는 경우를 위해 DEV_UI_ENABLED=1 오버라이드를 둔다 (QA 24) —
// 실서비스 프로젝트에는 이 값을 설정하지 않는다.
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';
import { BANGGUI_STORY_ID } from '@/lib/story';
import { UiRehearsalGallery, type RouteContext } from './gallery';
import story from '../../../../fixtures/story.banggui.json';

export default async function DevUiPage() {
  const enabled = process.env.DEV_UI_ENABLED === '1' || process.env.VERCEL_ENV !== 'production';
  if (!enabled) notFound();

  const ctx: RouteContext = {
    loggedIn: false,
    childId: null,
    storyId: BANGGUI_STORY_ID,
    completedSessionId: null,
    playSessionId: null,
  };
  const user = await getAuthedUser();
  if (user) {
    ctx.loggedIn = true;
    const admin = getSupabaseAdmin();
    const { data: child } = await admin
      .from('children')
      .select('id')
      .eq('parent_id', user.id)
      .limit(1)
      .maybeSingle();
    let childId = (child?.id as string) ?? null;

    // 더미 아이 시드 (UI 확인 전용) — 아이 프로필이 없으면 홈·목록·상세·진행 계열이 전부 비활성이라,
    // 로그인만 돼 있으면 실제 가입 플로우(/api/profiles)와 동일 컬럼 셋으로 아이 1명을 만들어 활성화한다.
    // 없을 때만 생성(멱등). 주의: 더미 아이는 프로필 선택·관리 화면에도 그대로 노출된다(실데이터 경로 공유).
    if (!childId) {
      const now = new Date().toISOString();
      // parents 행이 먼저 있어야 children FK가 성립 — /api/profiles와 동일하게 없을 때만 생성
      const { data: existingParent } = await admin
        .from('parents')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (!existingParent) {
        await admin.from('parents').insert({
          id: user.id,
          name: user.email?.split('@')[0] ?? '보호자',
          created_at: now,
        });
      }
      const { data: createdChild } = await admin
        .from('children')
        .insert({
          id: crypto.randomUUID(),
          parent_id: user.id,
          name: '진욱', // 리허설 갤러리 childName과 동일 — 아이 화면 호칭 표기 확인용
          birth_year: 2019,
          birth_date: '2019-05-10',
          avatar_key: 'boy-2',
          created_at: now,
        })
        .select('id')
        .single();
      if (createdChild) {
        // 동의 이력도 실제 플로우와 동일 1행 — 프로필 삭제(3.2)의 정리 경로가 함께 지울 수 있게
        await admin.from('child_consents').insert({
          id: crypto.randomUUID(),
          child_id: createdChild.id as string,
          consent_version: 'mvp_v1',
          verification_method: 'authenticated_parent',
          consented_at: now,
          withdrawn_at: null,
        });
        childId = createdChild.id as string;
      }
    }

    if (childId) {
      ctx.childId = childId;
      const { data: done } = await admin
        .from('story_sessions')
        .select('id')
        .eq('child_id', childId)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      ctx.completedSessionId = (done?.id as string) ?? null;
      // 이야기 진행(2.4)·학습완료 활동 미리보기용 — 상태 무관 최신 세션 (없으면 해당 항목 비활성)
      const { data: latest } = await admin
        .from('story_sessions')
        .select('id')
        .eq('child_id', childId)
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      ctx.playSessionId = (latest?.id as string) ?? null;

      // 더미 시드 (UI 확인 전용) — 세션 이력이 없으면 진행 중·완료 더미를 만들어 2.4/활동/2.5
      // 미리보기를 활성화한다. 없을 때만 생성(멱등)이고, 이 라우트는 실서비스 배포에서 404라 안전.
      // 주의: 진행 중 더미는 홈 이어하기 카드에도 그대로 노출된다(실데이터 경로 공유).
      if (!ctx.playSessionId || !ctx.completedSessionId) {
        const { data: sceneRows } = await admin
          .from('story_scenes')
          .select('id, scene_order')
          .eq('story_id', BANGGUI_STORY_ID)
          .order('scene_order');
        const firstScene = sceneRows?.[0];
        const lastScene = sceneRows?.[sceneRows.length - 1];
        if (firstScene && lastScene) {
          // /api/sessions 생성 로직과 동일 컬럼 셋 — id·타임스탬프는 스키마 기본값 없음(클라이언트 생성)
          const sessionDefaults = {
            child_id: childId,
            story_id: BANGGUI_STORY_ID,
            current_child_turn_count: 0,
            accumulated_elements: [],
            last_detected_elements: [],
            turns_without_new_element: 0,
            consecutive_low_information_turns: 0,
          };
          if (!ctx.playSessionId) {
            const now = new Date().toISOString();
            const { data: created } = await admin
              .from('story_sessions')
              .insert({
                ...sessionDefaults,
                id: crypto.randomUUID(),
                started_at: now,
                last_activity_at: now,
                status: 'in_progress',
                current_scene_id: firstScene.id,
                scene_goal_met: false,
              })
              .select('id')
              .single();
            ctx.playSessionId = (created?.id as string) ?? null;
          }
          if (!ctx.completedSessionId) {
            const completedAt = new Date().toISOString();
            const startedAt = new Date(new Date(completedAt).getTime() - 8 * 60_000).toISOString(); // 학습 시간 약 8분 표기용
            const { data: createdDone } = await admin
              .from('story_sessions')
              .insert({
                ...sessionDefaults,
                id: crypto.randomUUID(),
                started_at: startedAt,
                last_activity_at: completedAt,
                completed_at: completedAt,
                status: 'completed',
                current_scene_id: lastScene.id,
                scene_goal_met: true,
              })
              .select('id')
              .single();
            if (createdDone) {
              // 2.5는 post_activity_results.completed_at까지 있어야 렌더 (없으면 활동 화면으로 리다이렉트)
              await admin.from('post_activity_results').insert({
                id: crypto.randomUUID(),
                session_id: createdDone.id as string,
                submitted_order: story.story.post_activity_config.answer_order,
                is_order_correct: true,
                attempt_count: 1,
                retelling_text: '(dev 더미) 며느리가 방귀로 배나무의 배를 떨어뜨려 마을을 도왔어요.',
                completed_at: completedAt,
              });
              ctx.completedSessionId = createdDone.id as string;
            }
          }
        }
      }
    }
  }

  return <UiRehearsalGallery ctx={ctx} />;
}
