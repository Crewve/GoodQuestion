// 학습 완료 화면 (T055, 기능명세서 2.5) — Server Component 직접 조회.
// 완료 안내·오늘의 이야기(대표 이미지·제목·학습 시간)·오늘 모은 배지·이동 버튼 2종.
// 재진입 라우팅: completed_at 없음 → /play/[sessionId]/activity로 돌려보내 2.4.4/2.4.5 분기(서버 저장값 기준).
// 스타일: 피그마 「개발 배포용」 2.5 — 흰 콘텐츠 카드(주황 테두리) + 히어로 일러스트 + 요약 카드 2종 + 버튼 2종.
// 시안의 초원 배경·하이파이브 일러스트·배지 그래픽은 Storage 미보유 에셋 — 배경은 하늘→초원 그라데이션,
// 히어로는 이야기 마지막 장면(sc_banggui_08), 배지는 이모지 타일로 대체(figx 이미지 리포 복사 금지 규칙).
// 배지 명칭은 시안 "마음 나누기"가 데이터에 없어 기존 완주 배지 1종 표기 유지(실획득분만 표시 — 2.5 유효성).
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { sceneImageUrl, storyThumbnailUrl } from '@/lib/assets';
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
  const isBanggui = story.id === BANGGUI_STORY_ID;

  return (
    // h-dvh 고정 — 아이 화면 세로 스크롤 금지 (T071). 히어로가 flex-1로 줄어들며 한 화면 수납.
    <main className="flex h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#CDE8F8_0%,#EAF6E2_100%)] px-6 py-5">
      <section className="flex max-h-full w-full max-w-4xl flex-col gap-5 rounded-[33px] border border-primary bg-white p-7">
        {/* 히어로 일러스트 — 시안 하이파이브 컷 대체: 이야기 마지막 장면 (Storage 재사용) */}
        {/* 피그마 히어로 932×293 와이드 크롭 비율 고정 — flex 잔여 공간에 따라 세로로 늘지 않게 */}
        <div className="aspect-[932/293] min-h-24 w-full shrink overflow-hidden rounded-[22px] bg-sunny/20">
          {isBanggui ? (
            <Image
              src={sceneImageUrl('sc_banggui_08')}
              alt=""
              width={932}
              height={293}
              className="h-full w-full object-cover"
              priority
            />
          ) : (
            <div className="h-full w-full bg-sunny/30" aria-hidden />
          )}
        </div>

        {/* 완료 안내 */}
        <div className="shrink-0 text-center">
          <h1 className="font-display text-4xl text-ink">오늘의 이야기를 다 만났어요!</h1>
          <p className="mt-2 font-display text-xl font-normal text-[#6F6152]">
            이야기 장면을 보고, 내 생각을 말해보았어요.
          </p>
        </div>

        {/* 요약 카드 2종 — 오늘의 이야기 / 오늘 모은 배지 (실획득분만 표시 — 2.5 유효성) */}
        <div className="grid shrink-0 grid-cols-2 gap-4">
          <section className="flex items-center gap-5 rounded-[22px] bg-[#E8F5E9] px-5 py-4">
            {isBanggui ? (
              <Image
                src={storyThumbnailUrl(false)}
                alt=""
                width={88}
                height={88}
                className="size-[88px] shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <div className="size-[88px] shrink-0 rounded-2xl bg-sunny/30" aria-hidden />
            )}
            <div className="min-w-0">
              <h2 className="font-display text-lg text-[#177A4F]">오늘의 이야기</h2>
              <p className="mt-1 truncate font-display text-[22px] text-ink">{story.title}</p>
              {minutes !== null && (
                <p className="mt-1 font-display text-lg text-[#6F6152]">
                  <span aria-hidden>🕐</span> 이야기 시간 · 약 {minutes}분
                </p>
              )}
            </div>
          </section>
          <section className="flex items-center gap-5 rounded-[22px] bg-[#FFFDE7] px-5 py-4">
            <span
              className="flex size-[88px] shrink-0 items-center justify-center rounded-2xl bg-sunny/40 text-5xl"
              aria-hidden
            >
              🏅
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-lg text-[#B84A12]">오늘 모은 배지</h2>
              <p className="mt-1 truncate font-display text-[22px] text-ink">이야기 완주 배지</p>
              <p className="mt-1 font-display text-lg text-[#6F6152]">새 배지를 받았어요</p>
            </div>
          </section>
        </div>

        {/* 이동 버튼 2종 — 링크 대상 유지 */}
        <Link
          href="/my/badges"
          className="flex h-16 shrink-0 items-center justify-center gap-3 rounded-[22px] border-[3px] border-primary bg-[#FFFDE7] font-display text-2xl text-[#B84A12] shadow-[0_5px_15px_rgba(255,122,61,0.25)] active:bg-primary active:text-ink"
        >
          <span aria-hidden>🏆</span> 모은 배지 확인하기 <span aria-hidden>→</span>
        </Link>
        <Link
          href={storiesHref}
          className="flex h-16 shrink-0 items-center justify-center gap-3 rounded-[22px] bg-primary font-display text-2xl text-ink shadow-[0_5px_15px_rgba(255,122,61,0.25)] active:bg-ink active:text-white"
        >
          <span aria-hidden>📖</span> 다른 이야기 보기 <span aria-hidden>→</span>
        </Link>
      </section>
    </main>
  );
}
