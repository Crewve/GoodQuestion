// 배지 화면 (T059, 기능명세서 3.6 "배지 보러 가기") — 피그마 「개발 배포용」 3.6 정적 UI,
// 데이터 연동·카드 클릭 없음(MVP 명시). 마이페이지 계열이라 세로 스크롤 유지(T077 팀 결정).
// 구성(시안): 중앙 제목 "전래동화 이야기 여행"·완주 안내 문구·수행 현황 진행바·동화 카드 8종·다른 이야기 보기.
// 수치(3/7권)는 명세 예시 원문 그대로의 고정값 유지 — 완료 3종 배치로 진행바와 정합(기존 데이터 규칙).
// 카드 8종 전부 실제 에셋 사용 — 흥부와 놀부 원본(추천 7)이 2026-08-15 입고되어 '준비 중' 타일을 교체했다
// (피그마 코멘트 #102·#170, recommended/07-heungbu-nolbu.png). 수정사항 C4 / QA 14 이력 참조.
// 시안 금메달은 벡터(fig 내장 PNG 아님)라 SVG로 재현 — 공용 아이콘(components/icons.tsx MedalIcon)으로 통일.
// 하단 GNB는 스토리보드에 없어 제거(뒤로가기로 복귀).
// 색·폰트는 스토리보드 실측값 그대로 적용(수정사항 C5·C6 / QA 13·15) — 기존 대비 보정치는 팀 지시("색상 기준은
// 스토리보드 기준으로")에 따라 시안 원색으로 되돌렸다. 일부 조합은 대비 4.5:1 미달임을 인지하고 채택.
import Link from 'next/link';
import { withChild } from '@/components/bottom-nav';
import { ArrowRightIcon, BookIcon, MedalIcon } from '@/components/icons';
import { recommendedThumbnailUrls, storyThumbnailUrl } from '@/lib/assets';

type ReadState = '읽기 완료' | '읽는 중' | '읽기 전';

/** 상태 칩 — 스토리보드 읽기 상태 심볼 실측: 완료 #C4E0F3/#4FA9E8 · 읽는 중 #DDF5EC/#65CCA3 · 읽기 전 피치/#8A7A68 */
const STATE_CHIP: Record<ReadState, string> = {
  '읽기 완료': 'bg-[#C4E0F3] text-[#4FA9E8]',
  '읽는 중': 'bg-[#DDF5EC] text-[#65CCA3]',
  '읽기 전': 'bg-primary/15 text-[#8A7A68]',
};

export default async function BadgesPage(props: PageProps<'/my/badges'>) {
  // 아이 컨텍스트(?child=)는 뒤로가기·이야기 링크로 그대로 전파만 한다 (A3 — 홈 복귀 시 유지)
  const { child } = await props.searchParams;
  const childId = typeof child === 'string' ? child : null;

  const recommended = recommendedThumbnailUrls(); // 01선녀~06개미 순서 (fixtures/storage-assets.json)
  // 정적 카드 8종 — 읽기 완료 3종(진행바 3/7 정합)·읽는 중 1종·읽기 전 4종.
  // imageUrl=null은 '썸네일 준비 중' 타일로 렌더 (에셋 입고 시 URL만 채우면 됨)
  const cards: { title: string; imageUrl: string | null; state: ReadState }[] = [
    { title: '방귀 뀌는 며느리', imageUrl: storyThumbnailUrl(false), state: '읽기 완료' },
    { title: '선녀와 나무꾼', imageUrl: recommended[0], state: '읽는 중' },
    { title: '해와 달이 된 오누이', imageUrl: recommended[1], state: '읽기 전' },
    { title: '금도끼 은도끼', imageUrl: recommended[2], state: '읽기 완료' },
    { title: '토끼와 거북이', imageUrl: recommended[3], state: '읽기 완료' },
    { title: '혹부리 영감', imageUrl: recommended[4], state: '읽기 전' },
    { title: '개미와 베짱이', imageUrl: recommended[5], state: '읽기 전' },
    { title: '흥부와 놀부', imageUrl: recommended[6] ?? null, state: '읽기 전' },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* 헤더 — 중앙 제목만 (시안). '‹ 내정보' 네비게이터는 삭제 (QA 16) —
          이탈 경로는 하단 '다른 이야기 보기'와 브라우저 뒤로가기. 세로 스크롤 화면이라 상단 고정 (핸드오프 §2.1) */}
      <header className="sticky top-0 z-40 flex h-[70px] shrink-0 items-center justify-center bg-background">
        <h1 className="font-display text-[32px] text-ink">전래동화 이야기 여행</h1>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-5 pb-6 pt-2">
        <p className="flex items-center gap-1.5 px-4 font-display text-xl text-primary">
          8편을 모두 완주하면 나만의 이야기책이 완성돼요! 이야기를 읽고, 배지를 모아보세요
          <MedalIcon className="h-7 w-[26px] shrink-0" />
        </p>

        {/* 수행 현황 진행바 3/7권 — 명세 예시 원문 고정값 (기존 데이터 규칙 유지) */}
        <section className="rounded-3xl border border-[#EDE5D8] bg-white px-5 py-4 shadow-[0_4px_16px_rgba(58,44,30,0.08)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {/* 미션 단계 배지 (기능명세서 3.6 구성요소) — 명세 예시 원문 고정값. 시안에 없는 요소라
                  페이지 기존 칩 톤으로 임시 배치 — 디자인 확정 시 조정 (수정사항 체크리스트 D7) */}
              <span className="inline-flex items-center rounded-full bg-primary/15 px-3 py-1 font-display text-lg text-primary">
                미션 2단계
              </span>
              <h2 className="font-display text-xl text-[#8A7A68]">내가 읽은 책</h2>
            </div>
            <p className="font-display text-xl" aria-label="7권 중 3권 완료">
              <span className="text-sage">3</span>
              <span className="text-[#8A7A68]"> / 7 권</span>
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
                      // 썸네일 미입고 — 빈 색 블록이면 "이미지가 안 나온다"로 읽혀(QA 14) 준비 중임을 글로 밝힌다
                      <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1"
                        style={{ backgroundImage: 'linear-gradient(180deg, #FFF1DC 0%, #FFE8C9 100%)' }}
                        aria-hidden
                      >
                        <BookIcon className="size-8 text-primary/60" />
                        <span className="font-display text-base text-[#8A7A68]">이야기 준비 중</span>
                      </div>
                    )}
                    {done && (
                      // 스토리보드 mask 실측: 선형 그라데이션 #1E1408(불투명) → #111111 27%.
                      // 방향은 피그마 gradientTransform의 역행렬로 축을 구해(정규화 축 (0.92, 0.63) →
                      // 294×227 픽셀 보정) CSS 118deg로 환산. 쉼표가 든 그라데이션은 Tailwind 임의값에서
                      // 안전하게 생성되지 않아 인라인 style로 지정한다. 메달은 시안 비율(썸네일 높이의 68%)로 스케일.
                      <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          backgroundImage: 'linear-gradient(118deg, #1E1408 0%, rgba(17, 17, 17, 0.27) 100%)',
                        }}
                        aria-hidden
                      >
                        <MedalIcon className="h-[68%] w-auto drop-shadow-[5px_5px_6px_rgba(0,0,0,0.3)]" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1.5 px-2 pb-2.5 pt-2">
                    <p className="max-w-full truncate font-display text-xl text-ink">{card.title}</p>
                    {/* 상태 칩 폰트: Pretendard GOV → Cafe24 Ssurround (피그마 코멘트 #103) */}
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 font-display text-lg font-bold ${STATE_CHIP[card.state]}`}
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
          className="flex h-12 items-center justify-center gap-2.5 self-center rounded-3xl bg-primary px-6 font-display text-xl text-white shadow-[0_6px_16px_rgba(255,122,61,0.25)] active:bg-ink"
        >
          <BookIcon /> 다른 이야기 보기 <ArrowRightIcon className="size-5" />
        </Link>
      </main>
    </div>
  );
}
