// 배지 화면 (T059, 기능명세서 3.6 "배지 보러 가기") — 피그마 원안 정적 UI, 데이터 연동·카드 클릭 없음(MVP 명시).
// 구성: 미션 단계 배지(미션 2단계)·수행 현황 진행바(3/7권)·동화 카드 8종(읽기 전/읽는 중/읽기 완료)·다른 이야기 보기.
// 수치(2단계·3/7)는 명세 예시 원문 그대로의 고정값 — 완료 3종 배치로 진행바와 정합. 카드 8종 중 이미지가 있는 7종은
// 기존 에셋(방귀 썸네일+추천 6종) 재사용, 8종째(흥부와 놀부)는 에셋 미존재라 자리표시 타일(이야기 상세와 동일 패턴).
// 상태 표시는 색+아이콘+텍스트 병행(핸드오프 가이드 — 색상만으로 구분 금지).
import Link from 'next/link';
import { BottomNav } from '@/components/bottom-nav';
import { recommendedThumbnailUrls, storyThumbnailUrl } from '@/lib/assets';

type ReadState = '읽기 완료' | '읽는 중' | '읽기 전';

const STATE_BADGE: Record<ReadState, { icon: string; className: string }> = {
  '읽기 완료': { icon: '✓', className: 'bg-sage text-white' },
  '읽는 중': { icon: '▶', className: 'bg-sunny text-ink' },
  '읽기 전': { icon: '○', className: 'bg-ink/10 text-ink/60' },
};

export default function BadgesPage() {
  const recommended = recommendedThumbnailUrls(); // 01선녀~06개미 순서 (fixtures/storage-assets.json)
  // 정적 카드 8종 — 읽기 완료 3종(진행바 3/7 정합)·읽는 중 1종·읽기 전 4종
  const cards: { title: string; imageUrl: string | null; state: ReadState }[] = [
    { title: '방귀 뀌는 며느리', imageUrl: storyThumbnailUrl(false), state: '읽기 완료' },
    { title: '선녀와 나무꾼', imageUrl: recommended[0], state: '읽는 중' },
    { title: '해와 달이 된 오누이', imageUrl: recommended[1], state: '읽기 전' },
    { title: '금도끼 은도끼', imageUrl: recommended[2], state: '읽기 완료' },
    { title: '토끼와 거북이', imageUrl: recommended[3], state: '읽기 완료' },
    { title: '혹부리 영감', imageUrl: recommended[4], state: '읽기 전' },
    { title: '개미와 베짱이', imageUrl: recommended[5], state: '읽기 전' },
    { title: '흥부와 놀부', imageUrl: null, state: '읽기 전' },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-5 py-6">
        <Link href="/my" className="flex h-12 items-center gap-1 self-start font-semibold text-ink active:opacity-70">
          <span aria-hidden>‹</span> 내정보
        </Link>
        <h1 className="font-display text-3xl text-ink">모은 배지</h1>

        {/* 미션 단계 배지 */}
        <section className="flex items-center gap-4 rounded-3xl bg-white p-5">
          <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-full bg-sunny/40 text-4xl">
            🏅
          </span>
          <div>
            <p className="text-xl font-bold text-ink">미션 2단계</p>
            <p className="text-base text-ink/70">전래동화 독서습관 챌린지</p>
          </div>
        </section>

        {/* 수행 현황 진행바 3/7권 */}
        <section className="rounded-3xl bg-white p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-lg text-ink">수행 현황</h2>
            <span className="text-lg font-semibold text-ink" aria-label="7권 중 3권 완료">
              3/7권
            </span>
          </div>
          <div
            className="mt-2 h-3 overflow-hidden rounded-full bg-base"
            role="progressbar"
            aria-valuenow={3}
            aria-valuemin={0}
            aria-valuemax={7}
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((3 / 7) * 100)}%` }} />
          </div>
        </section>

        {/* 동화 카드 8종 — 표시 전용 (클릭 인터랙션 없음) */}
        <section aria-label="동화별 읽기 상태">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cards.map((card) => {
              const badge = STATE_BADGE[card.state];
              return (
                <li key={card.title} className="flex flex-col gap-2 rounded-2xl bg-white p-3">
                  {card.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Storage 외부 URL (기존 화면과 동일 패턴)
                    <img src={card.imageUrl} alt="" className="aspect-square w-full rounded-xl object-cover" />
                  ) : (
                    <div className="aspect-square w-full rounded-xl bg-sunny/30" aria-hidden />
                  )}
                  <p className="truncate text-base font-bold text-ink">{card.title}</p>
                  <span
                    className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-semibold ${badge.className}`}
                  >
                    <span aria-hidden>{badge.icon}</span> {card.state}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <Link
          href="/stories"
          className="flex h-14 items-center justify-center rounded-full bg-white text-xl font-bold text-ink active:bg-ink active:text-white"
        >
          다른 이야기 보기
        </Link>
      </main>
      <BottomNav active="my" childId={null} />
    </div>
  );
}
