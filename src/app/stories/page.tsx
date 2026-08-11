// 이야기 목록 (T049, 기능명세서 2.2) — Server Component 직접 조회 (contracts §읽기 기본).
// 주제·난이도 각 단일 선택, AND 조건 — 필터는 쿼리 파라미터로 표현되어 링크 이동 = 재조회.
// 아이 컨텍스트(child)는 홈(T048)→목록→상세→진행으로 쿼리 파라미터로 전파된다.
import Link from 'next/link';
import { BottomNav } from '@/components/bottom-nav';
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
}: {
  label: string;
  options: readonly string[];
  selected: string;
  buildHref: (option: string) => string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-ink/60">{label}</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${label} 필터`}>
        {options.map((option) => {
          const active = option === selected;
          return (
            <Link
              key={option}
              href={buildHref(option)}
              replace
              aria-checked={active}
              role="radio"
              className={`h-10 rounded-full px-4 leading-10 text-sm font-semibold active:opacity-80 ${
                active ? 'bg-primary text-white' : 'border border-ink/20 bg-white text-ink/70'
              }`}
            >
              {option}
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
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-8">
        <h1 className="font-display text-2xl text-ink">이야기 모음</h1>

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
        />

        {stories.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
            <p className="text-lg font-semibold text-ink">해당 조건의 이야기가 없어요</p>
            <Link
              href={withParams('/stories', { child })}
              replace
              className="h-12 rounded-full bg-primary px-6 leading-[3rem] font-semibold text-white"
            >
              필터 초기화
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {stories.map((story) => (
              <li key={story.id}>
                <Link
                  href={withParams(`/stories/${story.id}`, { child })}
                  className="flex h-full flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm active:opacity-80"
                >
                  {story.id === BANGGUI_STORY_ID ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Storage 외부 URL (기존 화면과 동일 패턴)
                    <img
                      src={storyThumbnailUrl(true)}
                      alt=""
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="aspect-square w-full rounded-xl bg-sunny/30" aria-hidden />
                  )}
                  <p className="font-display text-base text-ink">{story.title}</p>
                  <p className="line-clamp-2 text-sm text-ink/60">{story.summary}</p>
                  <div className="mt-auto flex flex-wrap gap-1 text-xs font-semibold">
                    {(story.topics ?? []).map((t) => (
                      <span key={t} className="rounded-full bg-sky/15 px-2 py-0.5 text-sky">
                        {t}
                      </span>
                    ))}
                    <span className="rounded-full bg-sage/15 px-2 py-0.5 text-sage">
                      {difficultyLabel(story.difficulty)}
                    </span>
                    {story.estimated_minutes != null && (
                      <span className="rounded-full bg-berry/15 px-2 py-0.5 text-berry">
                        {story.estimated_minutes}분
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <BottomNav active="stories" childId={child} />
    </div>
  );
}
