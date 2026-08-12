// 이용안내 (T058, 기능명세서 3.5) — 이용안내 항목 클릭 시 같은 화면에서 안내 내용 표시(아코디언).
// MVP 정적 콘텐츠 — 이용 방법은 실제 서비스 흐름 기준, 약관·정책 전문은 정식 오픈 시 게시 안내.
import Link from 'next/link';
import { BottomNav } from '@/components/bottom-nav';
import { AccordionItem, AccordionList } from '../accordion';

const GUIDES: { title: string; body: string }[] = [
  {
    title: '굿퀘스천 이용 방법',
    body: '① 아이 프로필을 등록하고 선택해요.\n② 홈에서 오늘의 이야기를 시작하면 동화 장면을 보고 들으며 캐릭터와 음성으로 대화해요.\n③ 이야기가 끝나면 학습완료 활동(카드 순서 맞추기 → 이야기 다시 말하기)으로 마무리해요.\n④ 완료한 학습은 내정보의 이번 주 활동과 배지에서 확인할 수 있어요.',
  },
  {
    title: '음성 대화가 잘 되려면',
    body: '조용한 곳에서 기기를 아이 가까이에 두고 이용해 주세요.\n캐릭터의 말이 끝나면 마이크가 자동으로 켜져요. 아이가 말을 마치면 마이크 버튼을 눌러 녹음을 끝낼 수 있어요.\n아이의 음성 원본은 저장되지 않고, 글자로 바꾼 텍스트만 학습 기록에 남아요.',
  },
  {
    title: '이용약관',
    body: '이용약관 전문은 정식 서비스 오픈 시 이곳에 게시됩니다.\n시연 버전에서는 학습 체험 목적의 이용만 제공됩니다.',
  },
  {
    title: '개인정보 처리방침',
    body: '개인정보 처리방침 전문은 정식 서비스 오픈 시 이곳에 게시됩니다.\n시연 버전은 보호자 계정 정보와 아이 프로필(이름·생년월일), 대화 텍스트 기록을 학습 기능 제공 목적으로만 저장하며, 아이의 음성 원본은 저장하지 않습니다.',
  },
];

export default function GuidePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-5 py-6">
        <Link href="/my" className="flex h-12 items-center gap-1 self-start font-semibold text-ink active:opacity-70">
          <span aria-hidden>‹</span> 내정보
        </Link>
        <h1 className="font-display text-3xl text-ink">이용안내</h1>

        <AccordionList>
          {GUIDES.map((guide) => (
            <AccordionItem key={guide.title} title={guide.title}>
              {guide.body}
            </AccordionItem>
          ))}
        </AccordionList>
      </main>
      <BottomNav active="my" childId={null} />
    </div>
  );
}
