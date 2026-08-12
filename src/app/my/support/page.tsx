// 고객센터 (T058, 기능명세서 3.4) — FAQ 항목 클릭 시 답변 표시(아코디언) + 1:1 문의 기능 표시.
// MVP 정적 콘텐츠 — FAQ가 비면 3.4 예외 원문 "등록된 FAQ가 없습니다" 노출, 1:1 문의는 준비 중 안내.
import Link from 'next/link';
import { BottomNav } from '@/components/bottom-nav';
import { AccordionItem, AccordionList } from '../accordion';

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

export default function SupportPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-5 py-6">
        <Link href="/my" className="flex h-12 items-center gap-1 self-start font-semibold text-ink active:opacity-70">
          <span aria-hidden>‹</span> 내정보
        </Link>
        <h1 className="font-display text-3xl text-ink">고객센터</h1>

        <h2 className="text-xl font-bold text-ink">자주 묻는 질문</h2>
        {FAQS.length === 0 ? (
          <p className="text-lg text-ink/70">{EMPTY_MESSAGE}</p>
        ) : (
          <AccordionList>
            {FAQS.map((faq) => (
              <AccordionItem key={faq.question} title={faq.question}>
                {faq.answer}
              </AccordionItem>
            ))}
          </AccordionList>
        )}

        {/* 1:1 문의 — 클릭 시 같은 화면에서 기능 표시 (3.4), MVP는 준비 중 안내 */}
        <AccordionList>
          <AccordionItem title="1:1 문의">
            1:1 문의는 준비 중입니다.{'\n'}서비스 준비가 완료되면 이곳에서 바로 문의를 남길 수 있어요.
          </AccordionItem>
        </AccordionList>
      </main>
      <BottomNav active="my" childId={null} />
    </div>
  );
}
