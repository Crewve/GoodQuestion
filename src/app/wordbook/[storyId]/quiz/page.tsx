// 단어 게임(퀴즈) 서버 셸 (T083, 피그마 2.6 단어장_퀴즈1~5·선택·정답·오답·마지막) —
// 개별 단어장과 동일하게 콘텐츠 있는 이야기만 유효. 진행 상태는 전부 클라이언트(퀴즈 5문항 고정).
import { redirect } from 'next/navigation';
import { WORDBOOK_STORY_ID } from '@/lib/wordbook';
import { QuizScreen } from './quiz-screen';

export default async function WordbookQuizPage(props: PageProps<'/wordbook/[storyId]/quiz'>) {
  const { storyId } = await props.params;
  const { child } = await props.searchParams;
  const childId = typeof child === 'string' ? child : null;
  if (storyId !== WORDBOOK_STORY_ID) redirect('/wordbook');
  return <QuizScreen childId={childId} />;
}
