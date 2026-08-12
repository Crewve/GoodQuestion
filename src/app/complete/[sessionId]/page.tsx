// 학습 완료 화면 (T055, 기능명세서 2.5) — Server Component 직접 조회.
// 완료 안내·오늘의 이야기(대표 이미지·제목·학습 시간)·오늘 모은 배지·이동 버튼 2종.
// 재진입 라우팅: completed_at 없음 → /play/[sessionId]/activity로 돌려보내 2.4.4/2.4.5 분기(서버 저장값 기준).
// 배지 에셋은 미저작(T059 배지 화면도 정적 원안) — 완주 배지 1종을 이모지 카드로 임시 표시, 기획 회신 시 교체.
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { storyThumbnailUrl } from '@/lib/assets';
import { BANGGUI_STORY_ID } from '@/lib/story';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/** 학습 시간 — 세션 시작→완료를 분 단위 올림(최소 1분). 완료 화면 표시 전용 */
function learningMinutes(startedAt: string | null, completedAt: string | null): number | null {
  if (!startedAt || !completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.max(1, Math.ceil(ms / 60_000));
}

export default async function CompletePage(props: PageProps<'/complete/[sessionId]'>) {
  const { sessionId } = await props.params;
  const user = await getAuthedUser();
  if (!user) redirect('/login');

  const admin = getSupabaseAdmin();
  const { data: session } = await admin
    .from('story_sessions')
    .select('id, child_id, story_id, started_at, completed_at')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) notFound();

  const { data: child } = await admin
    .from('children')
    .select('id, parent_id')
    .eq('id', session.child_id)
    .maybeSingle();
  if (!child || child.parent_id !== user.id) notFound();

  // 학습 완료 상태 검증 — 활동 미완료 세션은 활동 화면이 저장값 기준으로 2.4.4/2.4.5 분기
  const { data: result } = await admin
    .from('post_activity_results')
    .select('completed_at')
    .eq('session_id', session.id)
    .maybeSingle();
  if (!result?.completed_at) redirect(`/play/${session.id}/activity`);

  const { data: story, error: storyError } = await admin
    .from('stories')
    .select('id, title')
    .eq('id', session.story_id)
    .maybeSingle();
  if (storyError) throw new Error(`이야기 정보를 불러오지 못했습니다: ${storyError.message}`); // error.tsx 재시도
  if (!story) notFound();

  const minutes = learningMinutes(session.started_at, session.completed_at ?? result.completed_at);
  const storiesHref = `/stories?child=${session.child_id}`; // 아이 컨텍스트 유지 (T047~T050 전파 규칙)

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center gap-5 px-5 py-8">
      {/* 학습 완료 안내 */}
      <section className="flex w-full flex-col items-center gap-2 rounded-3xl bg-white p-6 text-center">
        <span className="text-5xl" aria-hidden>
          🎉
        </span>
        <h1 className="font-display text-3xl text-ink">오늘의 이야기 학습을 모두 마쳤어요!</h1>
        <p className="text-lg text-ink/80">이야기 듣기부터 말하기 활동까지 전부 해냈어요.</p>
      </section>

      {/* 오늘의 이야기 — 대표 이미지·제목·학습 시간 */}
      <section className="w-full rounded-3xl bg-white p-5">
        <h2 className="mb-3 font-display text-lg text-ink">오늘의 이야기</h2>
        <div className="flex items-center gap-4">
          {story.id === BANGGUI_STORY_ID ? (
            // eslint-disable-next-line @next/next/no-img-element -- Storage 외부 URL (기존 화면과 동일 패턴)
            <img src={storyThumbnailUrl(false)} alt="" className="size-24 shrink-0 rounded-2xl object-cover" />
          ) : (
            <div className="size-24 shrink-0 rounded-2xl bg-sunny/30" aria-hidden />
          )}
          <div className="min-w-0">
            <p className="truncate text-xl font-bold text-ink">{story.title}</p>
            {minutes !== null && <p className="text-lg text-ink/70">학습 시간 약 {minutes}분</p>}
          </div>
        </div>
      </section>

      {/* 오늘 모은 배지 — 완주 배지 1종 (실획득분만 표시 — 2.5 유효성) */}
      <section className="w-full rounded-3xl bg-white p-5">
        <h2 className="mb-3 font-display text-lg text-ink">오늘 모은 배지</h2>
        <div className="flex items-center gap-4">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-sunny/40 text-4xl" aria-hidden>
            🏅
          </span>
          <div>
            <p className="text-xl font-bold text-ink">이야기 완주 배지</p>
            <p className="text-base text-ink/70">「{story.title}」를 끝까지 완료했어요</p>
          </div>
        </div>
      </section>

      <div className="mt-2 flex w-full flex-col gap-3">
        <Link
          href="/my/badges"
          className="flex h-14 items-center justify-center rounded-full bg-primary text-xl font-bold text-white active:bg-ink"
        >
          모은 배지 확인하기
        </Link>
        <Link
          href={storiesHref}
          className="flex h-14 items-center justify-center rounded-full bg-white text-xl font-bold text-ink active:bg-ink active:text-white"
        >
          다른 이야기 보기
        </Link>
      </div>
    </main>
  );
}
