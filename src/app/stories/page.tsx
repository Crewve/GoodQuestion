// 이야기 목록 (T049, 기능명세서 2.2) — Server Component 직접 조회 (contracts §읽기 기본).
// 주제·난이도 각 단일 선택, AND 조건 — 필터는 쿼리 파라미터로 표현되어 링크 이동 = 재조회.
// 아이 컨텍스트(child)는 홈(T048)→목록→상세→진행으로 쿼리 파라미터로 전파된다.
// UI 리뉴얼: 피그마 「개발 배포용」 2.2 대조 — 헤더 69px·필터 칩 h36 r32·카드 369×284 r20 3열 gap20.
// h-dvh 한 화면 수납(페이지 세로 스크롤 금지) — 카드가 한 화면을 넘으면 그리드 영역만 내부 스크롤.
import Image from 'next/image';
import Link from 'next/link';
import { BottomNav } from '@/components/bottom-nav';
import { StoryBookIcon } from '@/components/icons';
import { storyThumbnailUrl } from '@/lib/assets';
import {
  DIFFICULTY_FILTERS,
  TOPIC_FILTERS,
  difficultyLabel,
  filterStories,
  type StoryRow,
} from '@/lib/stories-view';
import { BANGGUI_STORY_ID } from '@/lib/story';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic'; // 목록은 항상 최신 조회 (필터 재조회 규칙)

/* 칩 팔레트 — 피그마 「개발 배포용」 '주제'·'난이도' 심볼 실측: 배경 = 해당 색 13% 틴트, 글자 = 같은 색 원색
   (다름 Primary · 용기 Sunny · 친절 Berry · 나눔 Sage / 새싹 Sage · 튼튼 Sky · 도전 Berry).
   기존 명도 보정값은 QA 13("색상 기준은 스토리보드 기준으로")에 따라 철회 — 원색 대비 2.1~2.5:1 미달 인지하고 채택. */
const TOPIC_CHIP_BY_NAME: Record<string, string> = {
  다름: 'bg-primary/15 text-primary',
  용기: 'bg-sunny/15 text-sunny',
  친절: 'bg-berry/15 text-berry',
  나눔: 'bg-sage/15 text-sage',
};
/** 시안에 없는 주제어는 같은 4색을 순환 적용 */
const TOPIC_CHIP_CYCLE = [
  'bg-primary/15 text-primary',
  'bg-sunny/15 text-sunny',
  'bg-berry/15 text-berry',
  'bg-sage/15 text-sage',
] as const;

function topicChip(topic: string, index = 0): string {
  return TOPIC_CHIP_BY_NAME[topic] ?? TOPIC_CHIP_CYCLE[index % TOPIC_CHIP_CYCLE.length];
}

const DIFFICULTY_CHIP_TINT: Record<string, string> = {
  '새싹 이야기': 'bg-sage/15 text-sage',
  '튼튼 이야기': 'bg-sky/15 text-sky',
  '도전 이야기': 'bg-berry/15 text-berry',
};
const DIFFICULTY_CHIP_FALLBACK = 'bg-sky/15 text-sky';

function withParams(base: string, params: Record<string, string | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== '전체') search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

function FilterRow({
  label,
  options,
  selected,
  buildHref,
  className = '',
}: {
  label: string;
  options: readonly string[];
  selected: string;
  buildHref: (option: string) => string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-5 px-6 py-1.5 ${className}`}>
      <span className="shrink-0 text-lg font-bold text-ink">{label}</span>
      <div className="flex flex-wrap items-center gap-5" role="radiogroup" aria-label={`${label} 필터`}>
        {options.map((option) => {
          const active = option === selected;
          return (
            // 터치 48px 하한 — 시안 칩(36px)은 시각 요소로 유지하고 링크 히트 영역만 h-12로 확장
            <Link
              key={option}
              href={buildHref(option)}
              replace
              aria-checked={active}
              role="radio"
              className="flex h-12 items-center active:opacity-80"
            >
              <span
                className={`flex h-9 items-center rounded-full px-4 text-lg shadow-[0_2px_10px_rgba(58,44,30,0.1)] ${
                  active ? 'bg-primary font-bold text-white' : 'bg-white text-ink'
                }`}
              >
                {option}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default async function StoriesPage(props: PageProps<'/stories'>) {
  const sp = await props.searchParams;
  const topic = typeof sp.topic === 'string' ? sp.topic : '전체';
  const level = typeof sp.level === 'string' ? sp.level : '전체';
  const child = typeof sp.child === 'string' ? sp.child : null;

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('stories')
    .select('id, title, summary, difficulty, topics, estimated_minutes, status')
    .returns<StoryRow[]>();
  if (error) throw new Error(`이야기 목록 조회 실패: ${error.message}`); // error.tsx가 재시도 UI 제공

  const stories = filterStories(data ?? [], topic, level);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* 헤더 69px — 타이틀 32px Cafe24 + 하단 보더 #F0E4D3 (2.2) */}
      <header className="flex h-[69px] shrink-0 items-center gap-3 border-b border-[#F0E4D3] px-6">
        <h1 className="font-display text-[32px] leading-none text-ink">이야기 모음</h1>
        <StoryBookIcon className="h-[26px] w-[29px] text-ink" />
      </header>

      <div className="shrink-0">
        <FilterRow
          label="주제"
          options={TOPIC_FILTERS}
          selected={topic}
          buildHref={(option) => withParams('/stories', { topic: option, level, child })}
        />
        <FilterRow
          label="난이도"
          options={DIFFICULTY_FILTERS}
          selected={level}
          buildHref={(option) => withParams('/stories', { topic, level: option, child })}
          className="border-y border-[#F0E4D3]"
        />
      </div>

      <main className="mx-auto w-full min-h-0 max-w-[1194px] flex-1 overflow-y-auto px-6 py-6">
        {stories.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            <p className="font-display text-2xl text-ink">해당 조건의 이야기가 없어요</p>
            <Link
              href={withParams('/stories', { child })}
              replace
              // 스토리보드 Button 심볼: primary 필 + 흰 글자 (대비 2.6:1 미달 인지, QA 13 지시로 시안값 채택)
              className="flex h-[55px] items-center rounded-full bg-primary px-8 font-display text-xl font-bold text-white shadow-[0_5px_10px_rgba(255,122,61,0.33)] active:opacity-90"
            >
              필터 초기화
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-3 gap-5">
            {stories.map((story) => {
              const levelLabel = difficultyLabel(story.difficulty);
              return (
                <li key={story.id}>
                  <Link
                    href={withParams(`/stories/${story.id}`, { child })}
                    className="flex h-full flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_4px_16px_rgba(58,44,30,0.08)] active:opacity-80"
                  >
                    {story.id === BANGGUI_STORY_ID ? (
                      <Image
                        src={storyThumbnailUrl(true)}
                        alt=""
                        width={1448}
                        height={1086}
                        sizes="370px"
                        loading="eager"
                        className="aspect-[5/2] w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-[5/2] w-full bg-sunny/15" aria-hidden />
                    )}
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <p className="truncate font-display text-[22px] leading-tight text-ink">{story.title}</p>
                      <p className="truncate text-lg text-[#8A7A68]">{story.summary}</p>
                      <div className="mt-auto flex flex-wrap items-center gap-1.5">
                        {(story.topics ?? []).slice(0, 2).map((t, i) => (
                          <span
                            key={t}
                            className={`rounded-md px-2.5 py-1 font-display text-lg font-bold leading-none ${topicChip(t, i)}`}
                          >
                            {t}
                          </span>
                        ))}
                        <span
                          className={`rounded-lg px-2.5 py-1 font-display text-lg font-bold leading-none ${
                            DIFFICULTY_CHIP_TINT[levelLabel] ?? DIFFICULTY_CHIP_FALLBACK
                          }`}
                        >
                          {levelLabel}
                        </span>
                        {story.estimated_minutes != null && (
                          <span className="rounded-lg bg-[#F5EDE0] px-2.5 py-1 font-display text-lg font-bold leading-none text-[#8A7A68]">
                            {story.estimated_minutes}분
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <BottomNav active="stories" childId={child} />
    </div>
  );
}
