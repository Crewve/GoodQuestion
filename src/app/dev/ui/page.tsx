// 개발 전용 UI 리허설 갤러리 (/dev/ui) — 세션 진행 없이 이야기 진행·활동 화면을 상태별로 즉시 확인.
// 실제 라우트 화면(홈·목록·상세·인증·마이페이지 계열)은 iframe 미리보기용 컨텍스트(아이·완료 세션)를
// 서버에서 조회해 내린다. 프로덕션 빌드에서는 존재하지 않는 라우트로 취급한다(404).
import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';
import { BANGGUI_STORY_ID } from '@/lib/story';
import { UiRehearsalGallery, type RouteContext } from './gallery';

export default async function DevUiPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const ctx: RouteContext = { loggedIn: false, childId: null, storyId: BANGGUI_STORY_ID, completedSessionId: null };
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
    if (child) {
      ctx.childId = child.id as string;
      const { data: done } = await admin
        .from('story_sessions')
        .select('id')
        .eq('child_id', child.id)
        .eq('status', 'completed')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      ctx.completedSessionId = (done?.id as string) ?? null;
    }
  }

  return <UiRehearsalGallery ctx={ctx} />;
}
