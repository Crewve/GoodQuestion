// 배지 화면 (T059, 기능명세서 3.6 "배지 보러 가기") — 피그마 「개발 배포용」 3.6 정적 UI,
// 데이터 연동·카드 클릭 없음(MVP 명시). 마이페이지 계열이라 세로 스크롤 유지(T077 팀 결정).
// 구성(시안): 중앙 제목 "전래동화 이야기 여행"·완주 안내 문구·수행 현황 진행바·동화 카드 8종·다른 이야기 보기.
// 수치(3/7권)는 명세 예시 원문 그대로의 고정값 유지 — 완료 3종 배치로 진행바와 정합(기존 데이터 규칙).
// 카드 8종 중 이미지가 있는 7종은 기존 에셋(방귀 썸네일+추천 6종) 재사용, 8종째(흥부와 놀부)는 에셋 미존재라
// 자리표시 타일(이야기 상세와 동일 패턴). 시안 금메달은 벡터(fig 내장 PNG 아님)라 SVG로 재현(2026-08-13 실측:
// 금 원판 #F7C325/#EDB01B·크림 별 #FFF3C4·리본 #CE4444/#983535·스파클). 하단 GNB는 스토리보드에 없어 제거(뒤로가기로 복귀).
import Link from 'next/link';
import { withChild } from '@/components/bottom-nav';
import { recommendedThumbnailUrls, storyThumbnailUrl } from '@/lib/assets';

type ReadState = '읽기 완료' | '읽는 중' | '읽기 전';

/** 상태 칩 — 스토리보드 실측: 완료 #C4E0F3/파랑·읽는 중 #DDF5EC/민트·읽기 전 피치 (텍스트는 대비 하한 준수값) */
const STATE_CHIP: Record<ReadState, string> = {
  '읽기 완료': 'bg-[#C4E0F3] text-[#175E94]',
  '읽는 중': 'bg-[#DDF5EC] text-[#177A4F]',
  '읽기 전': 'bg-primary/15 text-[#6F6152]',
};

/** 완료 메달 — 시안 3.6 금별+빨간 리본 로제트 벡터 재현 (스토리보드 픽셀 실측 색) */
function MedalIcon({ className = 'size-24' }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 104" className={className} aria-hidden>
      <path d="M37 58 23 92l12-5 7 12 13-28z" fill="#CE4444" />
      <path d="M59 58l14 34-12-5-7 12-13-28z" fill="#983535" />
      <circle cx="48" cy="38" r="30" fill="#F7C325" />
      <circle cx="48" cy="38" r="23" fill="#EDB01B" />
      <path d="M48 24l5 10.1 11.2 1.6-8.1 7.9 1.9 11.1L48 49.5l-10 5.2 1.9-11.1-8.1-7.9 11.1-1.6z" fill="#FFF3C4" />
      <path d="M20 4l2.4 5.6L28 12l-5.6 2.4L20 20l-2.4-5.6L12 12l5.6-2.4z" fill="#FFF3C4" />
    </svg>
  );
}

/** 흰 아웃라인 펼친 책 글리프 — 스토리보드 '다른 이야기 보기' 아이콘 */
function BookIcon({ className = 'size-6' }: { className?: string }) {
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

export default async function BadgesPage(props: PageProps<'/my/badges'>) {
  // 아이 컨텍스트(?child=)는 뒤로가기·이야기 링크로 그대로 전파만 한다 (A3 — 홈 복귀 시 유지)
  const { child } = await props.searchParams;
  const childId = typeof child === 'string' ? child : null;

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
    <div className="flex min-h-dvh flex-col bg-background">
      {/* 헤더 — 중앙 제목 (시안), 뒤로가기는 내비게이션 유지용. 세로 스크롤 화면이라 상단 고정 (핸드오프 §2.1) */}
      <header className="sticky top-0 z-40 flex h-[70px] shrink-0 items-center justify-center bg-background">
        <Link
          href={withChild('/my', childId)}
          className="absolute left-2 flex h-12 items-center gap-1 px-3 font-semibold text-ink active:opacity-70"
        >
          <span aria-hidden>‹</span> 내정보
        </Link>
        <h1 className="text-[32px] font-bold text-ink">전래동화 이야기 여행</h1>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-5 pb-6 pt-2">
        <p className="flex items-center gap-1.5 px-4 text-xl font-bold text-[#B84A12]">
          8편을 모두 완주하면 나만의 이야기책이 완성돼요! 이야기를 읽고, 배지를 모아보세요
          <MedalIcon className="size-7 shrink-0" />
        </p>

        {/* 수행 현황 진행바 3/7권 — 명세 예시 원문 고정값 (기존 데이터 규칙 유지) */}
        <section className="rounded-3xl border border-[#EDE5D8] bg-white px-5 py-4 shadow-[0_4px_16px_rgba(58,44,30,0.08)]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#6F6152]">내가 읽은 책</h2>
            <p className="text-xl font-bold" aria-label="7권 중 3권 완료">
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
                      // 스토리보드: 옅은 디밍 + 중앙 로제트 메달 (기존 강한 그라데이션·이모지 대체)
                      <div className="absolute inset-0 flex items-center justify-center bg-[rgba(30,20,8,0.22)]" aria-hidden>
                        <MedalIcon className="size-24 drop-shadow-[2px_3px_4px_rgba(0,0,0,0.3)]" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1.5 px-2 pb-2.5 pt-2">
                    <p className="max-w-full truncate text-xl font-bold text-ink">{card.title}</p>
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

        {/* 스토리보드: 주황 필 + 흰 글자·흰 책 글리프 (대비 2.9:1 — 시안 확정값 채택) */}
        <Link
          href={withChild('/stories', childId)}
          className="flex h-12 items-center justify-center gap-2.5 self-center rounded-3xl bg-primary px-6 text-xl font-bold text-white shadow-[0_6px_16px_rgba(255,122,61,0.25)] active:bg-ink"
        >
          <BookIcon /> 다른 이야기 보기 <span aria-hidden>→</span>
        </Link>
      </main>
    </div>
  );
}
