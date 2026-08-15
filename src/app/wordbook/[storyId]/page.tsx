// 개별 단어장 서버 셸 (T083, 피그마 2.6 단어장_개별단어장_단어1~5) — 단어장 콘텐츠가 있는
// 이야기('방귀 뀌는 며느리')만 유효, 그 외 storyId는 목록으로 복귀. 데이터는 fixture라 DB 조회 없음.
import { redirect } from 'next/navigation';
import { WORDBOOK_STORY_ID } from '@/lib/wordbook';
import { WordDetailScreen } from './word-detail-screen';

export default async function WordbookStoryPage(props: PageProps<'/wordbook/[storyId]'>) {
  const { storyId } = await props.params;
  const { child } = await props.searchParams;
  const childId = typeof child === 'string' ? child : null;
  if (storyId !== WORDBOOK_STORY_ID) redirect('/wordbook'); // 준비 중 이야기 직접 URL 진입 방어
  return <WordDetailScreen childId={childId} />;
}
