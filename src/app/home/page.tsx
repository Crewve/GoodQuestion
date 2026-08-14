// 홈 화면 서버 셸 (T048, 기능명세서 2.0) — 아이 컨텍스트(?child=)를 검증하고 이어하기 노출 조건
// (진행 중 세션 존재 — /api/sessions와 동일한 status≠completed 기준)만 서버에서 판정한다.
// 진행률 n/N·%는 클라이언트가 T031 /api/sessions 응답을 재사용해 채운다(세션이 있을 때만 호출 — 멱등 재개).
// BANGGUI_STORY_ID는 node:crypto 기반(external-id.ts)이라 서버에서 계산해 props로 내린다.
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';
import { BANGGUI_STORY_ID } from '@/lib/story';
import storyFixture from '../../../fixtures/story.banggui.json';
import { HomeScreen, type StoryMeta } from './home-screen';

const { title, difficulty, topics, estimated_minutes } = (
  storyFixture as {
    story: { title: string; difficulty: string; topics: string[]; estimated_minutes: number };
  }
).story;

export default async function HomePage(props: PageProps<'/home'>) {
  const { child } = await props.searchParams;
  const childId = typeof child === 'string' ? child : null;
  if (!childId) redirect('/profiles'); // 아이 컨텍스트 없이는 홈 진입 불가 — 2.1로 되돌림

  const user = await getAuthedUser();
  if (!user) redirect('/login');

  const admin = getSupabaseAdmin();
  const { data: childRow } = await admin
    .from('children')
    .select('id, parent_id, name, avatar_key')
    .eq('id', childId)
    .maybeSingle();
  if (!childRow || childRow.parent_id !== user.id) redirect('/profiles'); // 소속 검증 (/api/sessions와 동일)

  const { data: session } = await admin
    .from('story_sessions')
    .select('id')
    .eq('child_id', childId)
    .eq('story_id', BANGGUI_STORY_ID)
    .neq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const story: StoryMeta = {
    id: BANGGUI_STORY_ID,
    title,
    difficulty,
    topics,
    estimatedMinutes: estimated_minutes,
  };

  return (
    <HomeScreen
      childId={childId}
      childName={childRow.name as string}
      childAvatarKey={(childRow.avatar_key as string | null) ?? null}
      story={story}
      hasSession={!!session}
    />
  );
}
