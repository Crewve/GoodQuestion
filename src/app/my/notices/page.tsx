// 공지사항 (T058, 기능명세서 3.3 / UI 리뉴얼 E — 피그마 「개발 배포용」 3.3 공지사항 목록·상세).
// 목록은 한 카드에 행 구분선(제목·날짜·화살표), 항목 클릭 시 같은 화면에서 내용 표시(아코디언).
// MVP 정적 콘텐츠 — 목록이 비면 3.3 예외 원문 "등록된 공지사항이 없습니다" 노출 (데이터 연동 시 교체 지점).
import { BottomNav, withChild } from '@/components/bottom-nav';
import { AccordionItem, AccordionList, MyPageHeader } from '../accordion';

const EMPTY_MESSAGE = '등록된 공지사항이 없습니다'; // 기능명세서 3.3 원문

const NOTICES: { title: string; date: string; body: string }[] = [
  {
    title: '굿퀘스천 시연 버전 안내',
    date: '2026.08.10',
    body: '지금 보고 계신 굿퀘스천은 시연용 MVP 버전입니다.\n동화 「방귀 뀌는 며느리」로 대화 학습 전체 흐름(이야기 감상 → 캐릭터 대화 → 학습완료 활동)을 체험하실 수 있어요.\n정식 서비스에서는 더 많은 전래동화가 순차적으로 추가될 예정입니다.',
  },
  {
    title: '아이 프로필 등록 안내',
    date: '2026.08.03',
    body: '한 계정에 아이 프로필을 최대 3명까지 등록할 수 있습니다.\n내정보 > 프로필 관리에서 아이 프로필을 추가하거나 수정·삭제할 수 있어요.',
  },
];

export default async function NoticesPage(props: PageProps<'/my/notices'>) {
  // 아이 컨텍스트(?child=)는 GNB·뒤로가기로 그대로 전파만 한다 (A3 — 홈 복귀 시 유지)
  const { child } = await props.searchParams;
  const childId = typeof child === 'string' ? child : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <MyPageHeader backHref={withChild('/my', childId)} />
      <main className="mx-auto flex w-full max-w-[808px] flex-1 flex-col px-6 pb-10 pt-5">
        <h2 className="text-2xl font-bold text-[#1E1A14]">공지사항</h2>

        {NOTICES.length === 0 ? (
          <p className="mt-10 text-base text-[#7A7268]">{EMPTY_MESSAGE}</p>
        ) : (
          <div className="mt-10">
            <AccordionList>
              {NOTICES.map((notice) => (
                <AccordionItem key={notice.title} title={notice.title} meta={notice.date} tone="body">
                  {notice.body}
                </AccordionItem>
              ))}
            </AccordionList>
          </div>
        )}
      </main>
      <BottomNav active="my" childId={childId} />
    </div>
  );
}
