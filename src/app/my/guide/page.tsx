// 이용안내 (T058, 기능명세서 3.5 / UI 리뉴얼 E — 피그마 「개발 배포용」 3.5 이용약관·이용 가이드).
// 상단 탭은 같은 화면 내 두 영역(가이드·약관)으로 앵커 이동, 항목은 아이콘 타일 카드 아코디언 —
// 클릭 시 같은 화면에서 안내 내용 표시(아코디언 동작 유지).
// MVP 정적 콘텐츠 — 이용 방법은 실제 서비스 흐름 기준, 약관·정책 전문은 정식 오픈 시 게시 안내.
import { BottomNav, withChild } from '@/components/bottom-nav';
import { AccordionItem, AccordionList, MyPageHeader } from '../accordion';

// 서비스 이용 가이드 영역 (3.5 가이드 카드 — 아이콘 타일 + 제목)
const GUIDES: { title: string; icon: string; body: string }[] = [
  {
    title: '굿퀘스천 이용 방법',
    icon: '📖',
    body: '① 아이 프로필을 등록하고 선택해요.\n② 홈에서 오늘의 이야기를 시작하면 동화 장면을 보고 들으며 캐릭터와 음성으로 대화해요.\n③ 이야기가 끝나면 학습완료 활동(카드 순서 맞추기 → 이야기 다시 말하기)으로 마무리해요.\n④ 완료한 학습은 내정보의 이번 주 활동과 배지에서 확인할 수 있어요.',
  },
  {
    title: '음성 대화가 잘 되려면',
    icon: '🎙️',
    body: '조용한 곳에서 기기를 아이 가까이에 두고 이용해 주세요.\n캐릭터의 말이 끝나면 마이크가 자동으로 켜져요. 아이가 말을 마치면 마이크 버튼을 눌러 녹음을 끝낼 수 있어요.\n아이의 음성 원본은 저장되지 않고, 글자로 바꾼 텍스트만 학습 기록에 남아요.',
  },
];

// 서비스 이용약관 영역 (3.5 약관 — 전문은 정식 오픈 시 게시)
const TERMS: { title: string; icon: string; body: string }[] = [
  {
    title: '이용약관',
    icon: '📋',
    body: '이용약관 전문은 정식 서비스 오픈 시 이곳에 게시됩니다.\n시연 버전에서는 학습 체험 목적의 이용만 제공됩니다.',
  },
  {
    title: '개인정보 처리방침',
    icon: '🔒',
    body: '개인정보 처리방침 전문은 정식 서비스 오픈 시 이곳에 게시됩니다.\n시연 버전은 보호자 계정 정보와 아이 프로필(이름·생년월일), 대화 텍스트 기록을 학습 기능 제공 목적으로만 저장하며, 아이의 음성 원본은 저장하지 않습니다.',
  },
];

export default async function GuidePage(props: PageProps<'/my/guide'>) {
  // 아이 컨텍스트(?child=)는 GNB·뒤로가기로 그대로 전파만 한다 (A3 — 홈 복귀 시 유지)
  const { child } = await props.searchParams;
  const childId = typeof child === 'string' ? child : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <MyPageHeader backHref={withChild('/my', childId)} />
      <main className="mx-auto flex w-full max-w-[808px] flex-1 flex-col px-6 pb-10 pt-5">
        <h2 className="text-2xl font-bold text-[#1E1A14]">이용안내</h2>

        {/* 상단 탭 — 같은 화면 내 약관·가이드 영역으로 앵커 이동 (가이드가 첫 영역이라 활성 표시) */}
        <div className="mt-10 flex overflow-hidden border border-[#E8E2DA] bg-white">
          <a
            href="#terms"
            className="flex h-[52px] flex-1 items-center justify-center text-[15px] text-[#7A7268] active:bg-background"
          >
            서비스 이용약관
          </a>
          <a
            href="#usage"
            aria-current="true"
            className="flex h-[52px] flex-1 items-center justify-center border-b-2 border-[#1E1A14] text-[15px] font-bold text-[#1E1A14] active:bg-background"
          >
            서비스 이용 가이드
          </a>
        </div>

        <section id="usage" className="mt-10 scroll-mt-28">
          <h3 className="sr-only">서비스 이용 가이드</h3>
          <AccordionList separated>
            {GUIDES.map((guide) => (
              <AccordionItem key={guide.title} title={guide.title} icon={guide.icon} separated>
                {guide.body}
              </AccordionItem>
            ))}
          </AccordionList>
        </section>

        <section id="terms" className="mt-3.5 scroll-mt-28">
          <h3 className="sr-only">서비스 이용약관</h3>
          <AccordionList separated>
            {TERMS.map((term) => (
              <AccordionItem key={term.title} title={term.title} icon={term.icon} tone="body" separated>
                {term.body}
              </AccordionItem>
            ))}
          </AccordionList>
        </section>
      </main>
      <BottomNav active="my" childId={childId} />
    </div>
  );
}
