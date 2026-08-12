// 학습완료 활동 컨테이너 (T055, 기능명세서 2.4.4·2.4.5) — Server Component가 재진입 라우팅을 판정한다.
// 분기(2.4.5 화면 이동): completed_at 존재 → /complete(2.5) / is_order_correct=true → 재구성(2.4.5)
// / false 또는 레코드 없음 → 카드 배열(2.4.4). 카드 콘텐츠는 stories.post_activity_config(R-09)가 SoT.
import { notFound, redirect } from 'next/navigation';
import { PostActivityFlow } from '@/components/post-activity-flow';
import { assetUrl } from '@/lib/assets';
import { parsePostActivityConfig } from '@/lib/post-activity';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export default async function PostActivityPage(props: PageProps<'/play/[sessionId]/activity'>) {
  const { sessionId } = await props.params;
  const user = await getAuthedUser();
  if (!user) redirect('/login');

  const admin = getSupabaseAdmin();
  const { data: session } = await admin
    .from('story_sessions')
    .select('id, child_id, story_id')
    .eq('id', sessionId)
    .maybeSingle();
  if (!session) notFound();

  // 소유권 확인 — 다른 보호자의 세션 URL 직접 접근 차단 (API와 동일 규칙)
  const { data: child } = await admin
    .from('children')
    .select('id, parent_id')
    .eq('id', session.child_id)
    .maybeSingle();
  if (!child || child.parent_id !== user.id) notFound();

  const { data: result } = await admin
    .from('post_activity_results')
    .select('is_order_correct, completed_at')
    .eq('session_id', session.id)
    .maybeSingle();
  if (result?.completed_at) redirect(`/complete/${session.id}`);

  const [{ data: story, error: storyError }] = await Promise.all([
    admin
      .from('stories')
      .select('id, title, post_activity_config')
      .eq('id', session.story_id)
      .maybeSingle(),
  ]);
  if (storyError) throw new Error(`이야기 조회 실패: ${storyError.message}`); // error.tsx가 재시도 제공
  const config = parsePostActivityConfig(story?.post_activity_config);
  if (!story || !config) {
    // 콘텐츠 미저작 이야기 — MVP 단일 이야기에서는 시드 누락 신호 (T051 seed 재실행 필요)
    throw new Error('이 이야기의 학습완료 활동 콘텐츠가 없습니다 (시드 여부 확인).');
  }

  // R-09 규약: cards 배열 순서 = answer_order(정답 순서). 무작위 제시는 CardOrdering(T053)이 수행하고,
  // 재구성(T054)은 정답 순서 그대로 4세트(카드+키워드 인덱스 쌍)를 표시한다.
  const cards = config.answer_order.map((id) => {
    const card = config.cards.find((c) => c.id === id)!;
    return { id: card.id, imageUrl: assetUrl(card.image_key), label: card.label };
  });

  return (
    <PostActivityFlow
      sessionId={session.id}
      storyId={session.story_id}
      storyTitle={story.title}
      cards={cards}
      keywords={config.keywords}
      initialStep={result?.is_order_correct ? 'retelling' : 'card-order'}
    />
  );
}
