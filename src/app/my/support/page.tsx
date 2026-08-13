// 고객센터 (T058, 기능명세서 3.4 / 피그마 「개발 배포용」 3.4 FAQ·1:1 문의).
// 스토리보드 확인(2026-08-13)에 따라 1:1 문의 내역을 별도 화면(/my/support/inquiries)으로 분리 —
// 상단 탭(FAQ 활성 · 1:1 문의 내역은 링크 이동) + FAQ 분리형 카드 아코디언 +
// 하단 1:1 문의 카드(스토리보드: 문의하기 → 문의 내역 화면 이동). FAQ가 비면 3.4 예외 원문 노출.
import Link from 'next/link';
import { BottomNav, withChild } from '@/components/bottom-nav';
import { AccordionItem, AccordionList, MyPageHeader } from '../accordion';

const EMPTY_MESSAGE = '등록된 FAQ가 없습니다'; // 기능명세서 3.4 원문

const FAQS: { question: string; answer: string }[] = [
  {
    question: '아이 프로필은 몇 명까지 등록할 수 있나요?',
    answer: '한 계정에 최대 3명까지 등록할 수 있어요.\n내정보 > 프로필 관리에서 추가·수정·삭제할 수 있습니다.',
  },
  {
    question: '아이의 목소리(녹음)는 저장되나요?',
    answer: '아니요. 아이의 음성 원본은 저장하지 않아요.\n말한 내용을 글자로 바꾼 텍스트만 학습 기록으로 저장됩니다.',
  },
  {
    question: '마이크가 동작하지 않아요.',
    answer: '브라우저의 마이크 권한이 허용되어 있는지 확인해 주세요.\n권한을 거부한 경우 주소창 옆 사이트 설정에서 마이크를 허용한 뒤, 화면의 마이크 버튼을 다시 눌러 주세요.',
  },
  {
    question: '완료한 이야기를 다시 볼 수 있나요?',
    answer: '네. 이야기 목록에서 완료한 이야기를 선택하면 처음부터 다시 시작할 수 있어요.',
  },
];

export default async function SupportPage(props: PageProps<'/my/support'>) {
  // 아이 컨텍스트(?child=)는 GNB·뒤로가기로 그대로 전파만 한다 (A3 — 홈 복귀 시 유지)
  const { child } = await props.searchParams;
  const childId = typeof child === 'string' ? child : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <MyPageHeader backHref={withChild('/my', childId)} />
      <main className="mx-auto flex w-full max-w-[808px] flex-1 flex-col px-6 pb-10 pt-5">
        <h2 className="text-2xl font-bold text-[#1E1A14]">고객센터</h2>

        {/* 상단 탭 — FAQ 활성, 1:1 문의 내역은 별도 화면 이동 (스토리보드 3.4) */}
        <div className="mt-10 flex overflow-hidden border border-[#E8E2DA] bg-white">
          <span
            aria-current="true"
            className="flex h-[52px] flex-1 items-center justify-center border-b-2 border-[#1E1A14] text-[15px] font-bold text-[#1E1A14]"
          >
            자주 묻는 질문(FAQ)
          </span>
          <Link
            href={withChild('/my/support/inquiries', childId)}
            className="flex h-[52px] flex-1 items-center justify-center text-[15px] text-[#7A7268] active:bg-background"
          >
            1:1 문의 내역
          </Link>
        </div>

        <h3 className="sr-only">자주 묻는 질문</h3>
        {FAQS.length === 0 ? (
          <p className="mt-10 text-base text-[#7A7268]">{EMPTY_MESSAGE}</p>
        ) : (
          <div className="mt-10">
            <AccordionList separated>
              {FAQS.map((faq) => (
                <AccordionItem key={faq.question} title={`Q. ${faq.question}`} separated>
                  {`A. ${faq.answer}`}
                </AccordionItem>
              ))}
            </AccordionList>
          </div>
        )}

        {/* 1:1 문의 — 스토리보드 3.4: 문의하기 클릭 시 문의 내역 화면으로 이동 */}
        <div className="mt-8 flex min-h-[118px] flex-col items-center justify-center gap-3 rounded-[14px] bg-[#FFEDE3] px-5 py-5">
          <span className="text-sm text-ink">원하는 답변을 찾지 못하셨나요?</span>
          <Link
            href={withChild('/my/support/inquiries', childId)}
            className="flex h-12 items-center rounded-full bg-primary px-6 text-sm font-bold text-white active:opacity-80"
          >
            1:1 문의하기
          </Link>
        </div>
      </main>
      <BottomNav active="my" childId={childId} />
    </div>
  );
}
