// 이야기 상세 (T049, 기능명세서 2.3) — Server Component 직접 조회.
// 줄거리 = stories.summary + 고정 문구 한 문단, '이런 것을 배워요'는 고정 텍스트 박스.
// 시작하기(T050)는 클라이언트 버튼이 /api/sessions 호출 후 /play/[sessionId]로 라우팅.
// UI 리뉴얼: 피그마 「개발 배포용」 2.3 대조 — 뒤로가기 알약 버튼(흰 배경 r32)·풀블리드 히어로(344/834)·
// 파스텔 칩·'이런 것을 배워요' 하늘색 박스(#DDF0FB r16)·주황 CTA r48. h-dvh 한 화면 수납(세로 스크롤 금지).
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookIcon, CheckIcon, ChevronLeftIcon } from '@/components/icons';
import { StoryStartButton } from '@/components/story-start-button';
import { storyThumbnailUrl } from '@/lib/assets';
import {
  LEARN_POINTS,
  LEARN_SECTION_TITLE,
  difficultyLabel,
  summaryWithTagline,
  type StoryRow,
} from '@/lib/stories-view';
import { BANGGUI_STORY_ID } from '@/lib/story';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';
import { StoryHero } from './story-hero';

export const dynamic = 'force-dynamic';

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

/**
 * 아이 컨텍스트 — child 쿼리 파라미터(프로필 선택 T047→홈 T048 전파 예정)가 우선.
 * 없으면 로그인 보호자의 첫 아이로 폴백해 T047/T048 합류 전에도 시작하기가 동작한다.
 * 소유권 검증은 /api/sessions가 최종 수행.
 */
async function resolveChildId(searchChild: string | null): Promise<string | null> {
  if (searchChild) return searchChild;
  const user = await getAuthedUser();
  if (!user) return null;
  const { data } = await getSupabaseAdmin()
    .from('children')
    .select('id')
    .eq('parent_id', user.id)
    .order('created_at')
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export default async function StoryDetailPage(props: PageProps<'/stories/[storyId]'>) {
  const { storyId } = await props.params;
  const sp = await props.searchParams;
  const searchChild = typeof sp.child === 'string' ? sp.child : null;

  const admin = getSupabaseAdmin();
  const { data: story, error } = await admin
    .from('stories')
    .select('id, title, summary, difficulty, topics, estimated_minutes, status')
    .eq('id', storyId)
    .maybeSingle<StoryRow>();
  if (error) throw new Error(`이야기 상세 조회 실패: ${error.message}`); // error.tsx가 재시도 UI 제공
  if (!story) notFound();

  const childId = await resolveChildId(searchChild);
  const backHref = searchChild ? `/stories?child=${searchChild}` : '/stories';
  const levelLabel = difficultyLabel(story.difficulty);

  // 태블릿 기준(1194×834) 한 화면 수납 — 히어로는 41dvh 캡, CTA는 mt-auto 하단 고정 (세로 스크롤 금지)
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <div className="flex h-20 shrink-0 items-center px-5">
        <Link
          href={backHref}
          className="flex h-12 items-center gap-2 rounded-full bg-white px-5 font-display text-2xl text-ink shadow-[0_3px_10px_rgba(0,0,0,0.25)] active:opacity-70"
        >
          <ChevronLeftIcon className="size-5" /> 이야기 모음
        </Link>
      </div>

      {story.id === BANGGUI_STORY_ID ? (
        // 로드 실패 폴백은 클라이언트 컴포넌트(story-hero)가 담당 (A5, 2.3 예외)
        // 타이틀 있는 썸네일 사용 — 피그마 코멘트 #175 (기존 제목X 버전에서 교체)
        <StoryHero src={storyThumbnailUrl(true)} />
      ) : (
        <div className="h-[41dvh] w-full shrink-0 bg-sunny/15" aria-hidden />
      )}

      <main className="mx-auto flex w-full min-h-0 max-w-[1194px] flex-1 flex-col px-6 pt-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {(story.topics ?? []).map((topic, i) => (
            <span
              key={topic}
              className={`rounded-md px-2.5 py-1 font-display text-lg font-bold leading-none ${
                topicChip(topic, i)
              }`}
            >
              {topic}
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

        <h1 className="mt-3 font-display text-[32px] leading-tight text-ink">{story.title}</h1>
        <p className="mt-2 font-display text-lg font-bold leading-relaxed text-[#8A7A68]">
          {summaryWithTagline(story.summary)}
        </p>

        <section className="mt-4 min-h-0 shrink overflow-hidden rounded-2xl border border-sky/25 bg-[#DDF0FB] p-4">
          <h2 className="flex items-center gap-2.5 font-display text-[22px] text-sky">
            {LEARN_SECTION_TITLE}
            <BookIcon className="size-6" />
          </h2>
          <ul className="mt-2.5 flex flex-col gap-2">
            {LEARN_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2.5 font-display text-lg font-bold text-[#8A7A68]">
                <CheckIcon className="w-3.5 shrink-0 text-sage" />
                {point}
              </li>
            ))}
          </ul>
        </section>

        <StoryStartButton storyId={story.id} childId={childId} />
      </main>
    </div>
  );
}
