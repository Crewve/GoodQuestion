// 배지 화면 (T059, 기능명세서 3.6 "배지 보러 가기") — 피그마 「개발 배포용」 3.6 정적 UI,
// 데이터 연동·카드 클릭 없음(MVP 명시). 마이페이지 계열이라 세로 스크롤 유지(T077 팀 결정).
// 구성(시안): 중앙 제목 "전래동화 이야기 여행"·완주 안내 문구·수행 현황 진행바·동화 카드 8종·다른 이야기 보기.
// 수치(3/7권)는 명세 예시 원문 그대로의 고정값 유지 — 완료 3종 배치로 진행바와 정합(기존 데이터 규칙).
// 카드 8종 중 이미지가 있는 7종은 기존 에셋(방귀 썸네일+추천 6종) 재사용, 8종째(흥부와 놀부)는 에셋 미존재라
// 자리표시 타일(이야기 상세와 동일 패턴). 시안의 금메달 벡터는 추출 불가 — 🏅 이모지+어둠 오버레이로 대체.
// 시안에 없는 뒤로가기·하단 GNB는 내비게이션 유실 방지를 위해 유지(마이페이지 계열 공통 패턴).
import Link from 'next/link';
import { BottomNav } from '@/components/bottom-nav';
import { recommendedThumbnailUrls, storyThumbnailUrl } from '@/lib/assets';

type ReadState = '읽기 완료' | '읽는 중' | '읽기 전';

/** 상태 칩 — 시안 3.6 읽기 상태 칩 2종 + 기존 '읽는 중' 상태는 sunny 변형으로 유지 (텍스트로 구분, 색상 단독 구분 금지) */
const STATE_CHIP: Record<ReadState, string> = {
  '읽기 완료': 'bg-[#C4E0F3] text-[#175E94]',
  '읽는 중': 'bg-sunny/50 text-ink',
  '읽기 전': 'bg-primary/15 text-[#6F6152]',
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
    <div className="flex min-h-dvh flex-col bg-base">
      {/* 헤더 — 중앙 제목 (시안), 뒤로가기는 내비게이션 유지용 */}
      <header className="relative flex h-[70px] shrink-0 items-center justify-center">
        <Link
          href="/my"
          className="absolute left-2 flex h-12 items-center gap-1 px-3 font-semibold text-ink active:opacity-70"
        >
          <span aria-hidden>‹</span> 내정보
        </Link>
        <h1 className="font-display text-[32px] text-ink">전래동화 이야기 여행</h1>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-5 pb-6 pt-2">
        <p className="px-4 font-display text-xl text-[#B84A12]">
          8편을 모두 완주하면 나만의 이야기책이 완성돼요! 이야기를 읽고, 배지를 모아보세요 🎖️
        </p>

        {/* 수행 현황 진행바 3/7권 — 명세 예시 원문 고정값 (기존 데이터 규칙 유지) */}
        <section className="rounded-3xl border border-[#EDE5D8] bg-white px-5 py-4 shadow-[0_4px_16px_rgba(58,44,30,0.08)]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-[#6F6152]">내가 읽은 책</h2>
            <p className="font-display text-xl" aria-label="7권 중 3권 완료">
              <span className="text-[#177A4F]">3</span>
              <span className="text-[#6F6152]"> / 7 권</span>
            </p>
          </div>
          <div
            className="mt-3 h-3 overflow-hidden rounded-full bg-[#DDF5EC]"
            role="progressbar"
            aria-valuenow={3}
            aria-valuemin={0}
            aria-valuemax={7}
          >
            <div
              className="h-full rounded-full bg-[linear-gradient(180deg,#3DBE8B_0%,#5DD9A8_100%)]"
              style={{ width: `${Math.round((3 / 7) * 100)}%` }}
            />
          </div>
        </section>

        {/* 동화 카드 8종 — 표시 전용 (클릭 인터랙션 없음), 읽기 완료는 메달 오버레이 */}
        <section aria-label="동화별 읽기 상태">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {cards.map((card) => {
              const done = card.state === '읽기 완료';
              return (
                <li
                  key={card.title}
                  className="flex flex-col overflow-hidden rounded-3xl border border-[#EDE5D8] bg-white shadow-[0_4px_12px_rgba(58,44,30,0.10)]"
                >
                  <div className="relative aspect-[273/158] w-full">
                    {card.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Storage 외부 URL (기존 화면과 동일 패턴)
                      <img src={card.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 bg-sunny/30" aria-hidden />
                    )}
                    {done && (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,rgba(30,20,8,0.65)_0%,rgba(17,17,17,0.25)_100%)]"
                        aria-hidden
                      >
                        <span className="text-5xl drop-shadow-[3px_3px_4px_rgba(0,0,0,0.4)]">🏅</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1.5 px-2 pb-2.5 pt-2">
                    <p className="max-w-full truncate font-display text-xl font-normal text-ink">{card.title}</p>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-lg font-bold ${STATE_CHIP[card.state]}`}
                    >
                      {card.state}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <Link
          href="/stories"
          className="flex h-12 items-center justify-center gap-2.5 self-center rounded-3xl bg-primary px-6 font-display text-xl text-ink shadow-[0_6px_16px_rgba(255,122,61,0.25)] active:bg-ink active:text-white"
        >
          <span aria-hidden>📖</span> 다른 이야기 보기 <span aria-hidden>→</span>
        </Link>
      </main>
      <BottomNav active="my" childId={null} />
    </div>
  );
}
