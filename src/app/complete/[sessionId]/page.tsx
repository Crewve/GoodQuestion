// 학습 완료 화면 (T055, 기능명세서 2.5) — Server Component 직접 조회.
// 완료 안내·오늘의 이야기(대표 이미지·제목·학습 시간)·오늘 모은 배지·이동 버튼 2종.
// 재진입 라우팅: completed_at 없음 → /play/[sessionId]/activity로 돌려보내 2.4.4/2.4.5 분기(서버 저장값 기준).
// 스타일: 피그마 「개발 배포용」 2.5 — 흰 콘텐츠 카드(주황 테두리) + 히어로 일러스트 + 요약 카드 2종 + 버튼 2종.
// 초원 배경·하이파이브 히어로·하트 메달 배지는 피그마 내장 원본에서 추출(public/complete-*.png) — 시안 동일 에셋.
// 배지 명칭은 시안 "마음 나누기"가 데이터에 없어 기존 완주 배지 1종 표기 유지(실획득분만 표시 — 2.5 유효성).
import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { withChild } from '@/components/bottom-nav';
import { storyThumbnailUrl } from '@/lib/assets';
import { BANGGUI_STORY_ID } from '@/lib/story';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/** 아웃라인 트로피 글리프 — 스토리보드 '모은 배지 확인하기' 아이콘 (주황 라인 스타일, currentColor 상속) */
function TrophyIcon({ className = 'size-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21c1.18.54 2.03 2.03 2.03 3.79" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

/** 흰 아웃라인 펼친 책 글리프 — 스토리보드 '다른 이야기 보기' 아이콘 (이모지 📖는 플랫폼별 파란 표지로 렌더돼 시안과 다름) */
function BookIcon({ className = 'size-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5.5C10.5 4.2 8.4 3.6 6 3.6c-1 0-2 .13-3 .4v14.5c1-.27 2-.4 3-.4 2.4 0 4.5.63 6 1.9 1.5-1.27 3.6-1.9 6-1.9 1 0 2 .13 3 .4V4c-1-.27-2-.4-3-.4-2.4 0-4.5.63-6 1.9v14.1" />
    </svg>
  );
}

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
  // 아이 컨텍스트 유지 (T047~T050 전파 규칙) — 배지 화면도 GNB로 홈에 복귀하므로 같이 실어 보낸다 (QA 17)
  const childId = (session.child_id as string | null) ?? null;
  const storiesHref = withChild('/stories', childId);
  const badgesHref = withChild('/my/badges', childId);
  const isBanggui = story.id === BANGGUI_STORY_ID;

  return (
    // h-dvh 고정 — 아이 화면 세로 스크롤 금지 (T071). 히어로가 flex-1로 줄어들며 한 화면 수납.
    // 배경·히어로·배지 그래픽은 피그마 내장 원본 추출본(public/complete-*.png) — 시안 2.5와 동일 에셋.
    <main className="flex h-dvh w-full flex-col items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#CDE8F8_0%,#EAF6E2_100%)] bg-[url('/complete-bg.png')] bg-cover bg-center px-6 py-5">
      <section className="flex max-h-full w-full max-w-4xl flex-col gap-5 rounded-[33px] border border-primary bg-white p-7">
        {/* 히어로 — 시안 하이파이브 일러스트 (932×293 와이드 크롭 비율 고정) */}
        <div className="aspect-[932/293] min-h-24 w-full shrink overflow-hidden rounded-[22px] bg-sunny/20">
          <Image
            src="/complete-hero.png"
            alt=""
            width={932}
            height={293}
            className="h-full w-full object-cover"
            priority
          />
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
            <Image
              src="/complete-badge.png"
              alt=""
              width={88}
              height={88}
              className="size-[88px] shrink-0 rounded-2xl object-cover"
            />
            <div className="min-w-0">
              <h2 className="font-display text-lg text-[#B84A12]">오늘 모은 배지</h2>
              <p className="mt-1 truncate font-display text-[22px] text-ink">이야기 완주 배지</p>
              <p className="mt-1 font-display text-lg text-[#6F6152]">새 배지를 받았어요</p>
            </div>
          </section>
        </div>

        {/* 이동 버튼 2종 — 링크 대상 유지. 스토리보드 실측(2026-08-13): 높이 60px·테두리 2px,
            글자 색은 #B84A12·ink 그대로 시안과 일치(아동 대비 하한 준수값) */}
        <Link
          href={badgesHref}
          className="flex h-[60px] shrink-0 items-center justify-center gap-3 rounded-[22px] border-2 border-primary bg-[#FFFDE7] font-display text-2xl text-[#B84A12] shadow-[0_5px_15px_rgba(255,122,61,0.25)] active:bg-primary active:text-ink"
        >
          <TrophyIcon /> 모은 배지 확인하기 <span aria-hidden>→</span>
        </Link>
        <Link
          href={storiesHref}
          className="flex h-[60px] shrink-0 items-center justify-center gap-3 rounded-[22px] bg-primary font-display text-2xl text-ink shadow-[0_5px_15px_rgba(255,122,61,0.25)] active:bg-ink active:text-white"
        >
          <BookIcon className="size-7 text-white" /> 다른 이야기 보기 <span aria-hidden>→</span>
        </Link>
      </section>
    </main>
  );
}
