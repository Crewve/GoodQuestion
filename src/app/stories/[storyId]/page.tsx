// 이야기 상세 (T049, 기능명세서 2.3) — Server Component 직접 조회.
// 줄거리 = stories.summary + 고정 문구 한 문단, '이런 것을 배워요'는 고정 텍스트 박스.
// 시작하기(T050)는 클라이언트 버튼이 /api/sessions 호출 후 /play/[sessionId]로 라우팅.
// UI 리뉴얼: 피그마 「개발 배포용」 2.3 대조 — 뒤로가기 알약 버튼(흰 배경 r32)·풀블리드 히어로(344/834)·
// 파스텔 칩·'이런 것을 배워요' 하늘색 박스(#DDF0FB r16)·주황 CTA r48. h-dvh 한 화면 수납(세로 스크롤 금지).
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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

export const dynamic = 'force-dynamic';

/* 칩 팔레트 (피그마 2.3) — 파스텔 배경은 시안 그대로,
   글자색은 같은 색상 계열에서 명도만 낮춰 대비 4.5:1 하한을 맞춘 값(시안 원색은 2.1~2.5:1 미달). */
const TOPIC_CHIP_TINTS = ['bg-primary/15 text-[#B33D0D]', 'bg-sunny/15 text-[#92400E]'] as const;
const DIFFICULTY_CHIP_TINT: Record<string, string> = {
  '새싹 이야기': 'bg-sage/15 text-[#047857]',
  '튼튼 이야기': 'bg-sky/15 text-[#075985]',
  '도전 이야기': 'bg-berry/15 text-[#9F1239]',
};

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
    <div className="flex h-dvh flex-col overflow-hidden bg-base">
      <div className="flex h-20 shrink-0 items-center px-5">
        <Link
          href={backHref}
          className="flex h-12 items-center gap-2 rounded-full bg-white px-5 font-display text-2xl text-ink shadow-[0_3px_10px_rgba(0,0,0,0.25)] active:opacity-70"
        >
          <span aria-hidden>‹</span> 이야기 모음
        </Link>
      </div>

      {story.id === BANGGUI_STORY_ID ? (
        <Image
          src={storyThumbnailUrl(false)}
          alt=""
          width={1448}
          height={1086}
          sizes="100vw"
          preload
          className="h-[41dvh] w-full shrink-0 bg-[#FFE8C9] object-cover"
        />
      ) : (
        <div className="h-[41dvh] w-full shrink-0 bg-sunny/15" aria-hidden />
      )}

      <main className="mx-auto flex w-full min-h-0 max-w-[1194px] flex-1 flex-col px-6 pt-6">
        <div className="flex flex-wrap items-center gap-1.5">
          {(story.topics ?? []).map((topic, i) => (
            <span
              key={topic}
              className={`rounded-md px-2.5 py-1 font-display text-lg font-bold leading-none ${
                TOPIC_CHIP_TINTS[i % TOPIC_CHIP_TINTS.length]
              }`}
            >
              {topic}
            </span>
          ))}
          <span
            className={`rounded-lg px-2.5 py-1 font-display text-lg font-bold leading-none ${
              DIFFICULTY_CHIP_TINT[levelLabel] ?? 'bg-sky/15 text-[#075985]'
            }`}
          >
            {levelLabel}
          </span>
          {story.estimated_minutes != null && (
            <span className="rounded-lg bg-[#F5EDE0] px-2.5 py-1 font-display text-lg font-bold leading-none text-[#75664F]">
              {story.estimated_minutes}분
            </span>
          )}
        </div>

        <h1 className="mt-3 font-display text-[32px] leading-tight text-ink">{story.title}</h1>
        <p className="mt-2 font-display text-lg font-bold leading-relaxed text-[#75664F]">
          {summaryWithTagline(story.summary)}
        </p>

        <section className="mt-4 min-h-0 shrink overflow-hidden rounded-2xl border border-sky/25 bg-[#DDF0FB] p-4">
          <h2 className="font-display text-[22px] text-[#075985]">{LEARN_SECTION_TITLE}</h2>
          <ul className="mt-2.5 flex flex-col gap-2">
            {LEARN_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2 font-display text-lg font-bold text-[#75664F]">
                <span aria-hidden className="text-[#047857]">
                  ✓
                </span>
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
