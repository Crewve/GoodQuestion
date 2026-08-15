// 단어장 목록 (T083, 피그마 「개발 배포용」 2.6 단어장 _전체) — 이야기별 단어장 진입 화면.
// 기능명세서에는 "단어장 GNB 이동 없음"으로 기재됐으나 2.6 시안 신설로 활성 — 충돌 기록은 tasks.md T083.
// 콘텐츠는 fixture SoT(단어장은 '방귀 뀌는 며느리'만) — DB 조회 없는 Server Component.
// 시안 실측: 헤더 69px(타이틀 fs32+책 아이콘)·안내 fs18·카드 369×238(이미지 182+제목 바 56) 3열 gap20.
// 단어장 없는 이야기 6종은 시안엔 일반 카드지만 클릭 무반응 방지를 위해 흐림+준비 중 처리(QA 3 관례,
// 홈·이야기 목록 더미 카드와 동일). 아이 화면 — 카드가 넘치면 그리드 영역만 내부 스크롤(2.2 관례).
import Image from 'next/image';
import Link from 'next/link';
import { BottomNav, withChild } from '@/components/bottom-nav';
import { recommendedThumbnailUrls, storyThumbnailUrl } from '@/lib/assets';
import { BANGGUI_STORY_ID } from '@/lib/story';

/** 시안 카드 순서 — 방귀(활성) 다음 더미 6종. 인덱스는 recommended/ 썸네일(01~) 순번 */
const DUMMY_ORDER: { title: string; thumbIndex: number }[] = [
  { title: '해와 달이 된 오누이', thumbIndex: 1 },
  { title: '금도끼 은도끼', thumbIndex: 2 },
  { title: '토끼와 거북이', thumbIndex: 3 },
  { title: '혹부리 영감', thumbIndex: 4 },
  { title: '개미와 베짱이', thumbIndex: 5 },
  { title: '선녀와 나무꾼', thumbIndex: 0 },
];

export default async function WordbookPage(props: PageProps<'/wordbook'>) {
  const { child } = await props.searchParams;
  const childId = typeof child === 'string' ? child : null;
  const thumbs = recommendedThumbnailUrls();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* 헤더 — 시안 h69 · fs32 타이틀 + 책 아이콘 · 하단 보더 */}
      <header className="flex h-[69px] shrink-0 items-center gap-2 border-b border-[#F0E4D3] bg-background px-6">
        <h1 className="font-display text-[32px] leading-none text-ink">단어장</h1>
        <svg width="32" height="32" viewBox="0 0 24 24" className="text-ink" aria-hidden fill="currentColor">
          <path d="M11.2 6.2C9.7 4.9 7.6 4.3 5 4.3c-.9 0-1.7.1-2.5.3v13.6c.8-.2 1.6-.3 2.5-.3 2.6 0 4.7.7 6.2 2V6.2z" />
          <path d="M12.8 6.2c1.5-1.3 3.6-1.9 6.2-1.9.9 0 1.7.1 2.5.3v13.6c-.8-.2-1.6-.3-2.5-.3-2.6 0-4.7.7-6.2 2V6.2z" />
        </svg>
      </header>

      <main className="mx-auto flex w-full max-w-[1194px] min-h-0 flex-1 flex-col overflow-hidden px-6">
        <p className="shrink-0 pt-5 pb-1 font-display text-lg text-[#8A7A68]">
          이야기별로 모은 단어를 확인해보세요. 읽은 이야기마다 단어가 쌓여요.
        </p>

        {/* 카드 그리드 — 238px 고정 행, 넘치면 내부 스크롤 (헤더·GNB 고정 유지) */}
        <div className="mt-4 grid min-h-0 flex-1 auto-rows-[238px] grid-cols-3 content-start gap-5 overflow-y-auto pb-5">
          <Link
            href={withChild(`/wordbook/${BANGGUI_STORY_ID}`, childId)}
            className="flex h-full flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_4px_16px_rgba(58,44,30,0.08)] transition-transform active:scale-95"
          >
            <div className="relative h-[182px] shrink-0 overflow-hidden bg-sunny/15">
              <Image src={storyThumbnailUrl(true)} alt="" fill sizes="370px" loading="eager" className="object-cover" />
            </div>
            <div className="flex flex-1 items-center px-4">
              <p className="truncate font-display text-[22px] leading-tight text-ink">방귀 뀌는 며느리</p>
            </div>
          </Link>
          {DUMMY_ORDER.map((dummy) => (
            // 아직 단어장이 없는 이야기 — 클릭 이벤트 미부여, 흐림+준비 중 (QA 3 관례)
            <div
              key={dummy.title}
              aria-disabled
              className="flex h-full flex-col overflow-hidden rounded-[20px] bg-white opacity-50 shadow-[0_4px_16px_rgba(58,44,30,0.08)]"
            >
              <div className="relative h-[182px] shrink-0 overflow-hidden bg-sunny/15">
                <Image src={thumbs[dummy.thumbIndex]} alt="" fill sizes="370px" loading="eager" className="object-cover" />
              </div>
              <div className="flex flex-1 items-center gap-2 px-4">
                <p className="truncate font-display text-[22px] leading-tight text-ink">{dummy.title}</p>
                <span className="shrink-0 rounded-lg bg-[#EFE7DA] px-2.5 py-1 font-display text-lg font-bold leading-none text-[#75664F]">
                  준비 중
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav active="wordbook" childId={childId} />
    </div>
  );
}
