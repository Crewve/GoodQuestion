// 이야기 상세 (T049, 기능명세서 2.3) — Server Component 직접 조회.
// 줄거리 = stories.summary + 고정 문구 한 문단, '이런 것을 배워요'는 고정 텍스트 박스.
// 시작하기(T050)는 클라이언트 버튼이 /api/sessions 호출 후 /play/[sessionId]로 라우팅.
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

  // 태블릿 기준(1194×834) 한 화면 수납 — 상세 이미지는 max-h 캡으로 세로 스크롤 방지 (E2E 후속 제보)
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-5 py-5">
      <Link href={backHref} className="flex h-12 items-center gap-1 self-start font-semibold text-ink active:opacity-70">
        <span aria-hidden>‹</span> 이야기 모음
      </Link>

      {story.id === BANGGUI_STORY_ID ? (
        <Image
          src={storyThumbnailUrl(false)}
          alt=""
          width={1448}
          height={1086}
          sizes="(max-width: 640px) 100vw, 576px"
          preload
          className="max-h-[34vh] w-full rounded-3xl object-cover"
        />
      ) : (
        <div className="aspect-video w-full rounded-3xl bg-sunny/30" aria-hidden />
      )}

      <div className="flex flex-wrap gap-2 text-sm font-semibold">
        {(story.topics ?? []).map((topic) => (
          <span key={topic} className="rounded-full bg-sky/15 px-3 py-1 text-sky">
            {topic}
          </span>
        ))}
        <span className="rounded-full bg-sage/15 px-3 py-1 text-sage">{difficultyLabel(story.difficulty)}</span>
        {story.estimated_minutes != null && (
          <span className="rounded-full bg-berry/15 px-3 py-1 text-berry">약 {story.estimated_minutes}분</span>
        )}
      </div>

      <h1 className="font-display text-3xl text-ink">{story.title}</h1>
      <p className="text-base leading-relaxed text-ink/80">{summaryWithTagline(story.summary)}</p>

      <section className="rounded-2xl bg-white p-5">
        <h2 className="mb-3 font-display text-lg text-ink">{LEARN_SECTION_TITLE}</h2>
        <ul className="flex flex-col gap-2">
          {LEARN_POINTS.map((point) => (
            <li key={point} className="flex items-center gap-2 text-base text-ink/80">
              <span aria-hidden className="text-sage">
                ✓
              </span>
              {point}
            </li>
          ))}
        </ul>
      </section>

      <StoryStartButton storyId={story.id} childId={childId} />
    </main>
  );
}
