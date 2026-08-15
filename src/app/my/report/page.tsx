// 보호자 리포트 (선택 요건, 기획 「(선택 요건) 보호자 리포트」 / 피그마 「개발 배포용」 3.7 —
// 652:6021 말하기 역량 분석 · 652:6177 대표 발화 · 652:6197 가정 학습 가이드).
// 마이페이지 3.1 '보호자 리포트' 버튼에서 진입. ?tab= 쿼리로 3개 탭 전환(3.5 이용안내와 같은 서버 렌더 방식).
// 데이터는 기획 문서 지시대로 「방귀 뀌는 며느리」 예시 데이터 고정 — "현재는 예시 데이터를 구성하여 이를
// 기준으로 구현… 향후 실제 발화 데이터를 활용하여 월간 리포트로 확장 예정". 아이 이름만 실제 프로필로 치환.
// 월 선택은 시안의 드롭다운 형태를 따르되 리포트가 이번 달 1건뿐이라 표시 전용(전환 없음).
// 작성 원칙(문서 §8): 잘한 점 먼저·단정 표현 금지·내부 태그(DECISION 등) 비노출 — 카피에 반영됨.
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BottomNav, withChild } from '@/components/bottom-nav';
import { ChevronDownIcon, ChevronLeftThinIcon, UserIcon } from '@/components/icons';
import { avatarUrl, type AvatarKey } from '@/lib/assets';
import { substituteChildName } from '@/lib/child-name';
import { givenName } from '@/lib/profile-display';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

/* ── 예시 리포트 데이터 (방귀 뀌는 며느리 — 기획 문서 §3~§6 예시 원문·시안 카피) ────────────── */

// 시안 원문의 한 줄 피드백 첫 문장은 편집 중 문구가 중복돼 있어("…자신의 생각도 잘 표인물의 마음을…")
// 의미가 이어지도록 정리했다 — 시안 개정 시 원문으로 재대조 필요.
const ONE_LINE_FEEDBACK = [
  '이야기를 잘 이해하고, 인물의 마음을 헤아리며 자신의 생각도 자신 있게 표현하는 힘이 정말 좋아요!',
  '다음엔 "왜 그렇게 생각했어?"라는 질문으로 이유까지 함께 말해보면 훨씬 탄탄한 이야기가 될 거예요.',
];

type SubSkill = { name: string; desc: string; score: number; icon: 'eye' | 'heart' | 'swap' | 'bulb' | 'search' };

const VOCAB = {
  caption: '이야기 속 주요 단어를 사용하고\n새로운 낱말에도 관심을 보였어요.',
  words: ['방귀', '며느리', '시아버지', '속상하다', '미안하다', '용기', '항아리', '깜짝 놀라다'],
  feedback:
    '이야기 속 단어를 상황에 맞게 잘 사용했어요. 다만 비슷한 단어를 반복해서 쓰는 편이라, 다양한 표현을 시도해보면 더 좋을 것 같아요.',
  score: 3,
};

const EXPRESSION: { caption: string; subs: SubSkill[] } = {
  caption: '인물의 감정을 짐작하고\n자신의 생각을 구체적으로 말했어요.',
  subs: [
    { name: '관점과 공감', desc: '인물의 입장이 되어 생각을 해봅니다.', score: 5, icon: 'eye' },
    { name: '감정 표현', desc: '마음 상태와 인물의 정서를 풍부히 말합니다.', score: 4, icon: 'heart' },
    { name: '상호작용', desc: '상대의 말에 맞게 반응하고, 구체적으로 요청합니다.', score: 4, icon: 'swap' },
  ],
};

const LOGIC: { caption: string; subs: SubSkill[] } = {
  caption: '자신의 생각과 이유를 말하고\n다음 결과도 예측하려는 모습이 보여요.',
  subs: [
    { name: '생각과 이유', desc: '원인과 결과를 연결지어 논리적으로 표현합니다.', score: 2, icon: 'bulb' },
    { name: '결과와 해결', desc: '결과를 예상하고 문제를 해결할 새로운 대안을 구상합니다.', score: 3, icon: 'search' },
  ],
};

/** 대표 발화 4종 — 발화 원문(줄바꿈은 시안 배치)과 선정 이유 한 문장 (문서 §5) */
const UTTERANCES: { quote: string; reason: string }[] = [
  {
    quote: '며느리가 속상했을 것 같아.\n시아버지가 먼저 미안하다고 해야 해.',
    reason: '인물의 감정을 이해하고, 관계를 회복할 수 있는 방법까지 생각해서 말했어요.',
  },
  {
    quote: '며느리가 계속 참아서\n배가 진짜 아팠을 것 같아.',
    reason: '인물의 상황을 보고 몸의 불편함과 마음을 함께 짐작해 표현했어요.',
  },
  {
    quote: '며느리가 방귀로 배를\n떨어뜨려서 사람들을 도와줬어',
    reason: '이야기 속 중요한 사건을 골라 원인과 결과가 이어지도록 설명했어요.',
  },
  {
    quote: '나였으면 며느리한테 미안하다고 했을 것 같아.',
    reason: '이야기 상황을 자신의 입장에서 생각하고 해결 방법을 말로 표현했어요.',
  },
];

/** 가정 학습 가이드 — 이야기 주제 2문항 + 일상 연결 2문항, 학습 목표 한 줄 (문서 §6) */
const GUIDE_STORY: { question: string; goal: string }[] = [
  { question: '며느리는 왜 방귀를 계속 참았을까?', goal: '이유와 설명을 연습해요' },
  { question: '시아버지는 나중에 왜 며느리에게 미안해졌을까?', goal: '생각 변화를 연습해요' },
];
const GUIDE_DAILY: { question: string; goal: string }[] = [
  { question: '너도 하고 싶은 말을 참았던 적이 있어? 그때 기분이 어땠어?', goal: '경험 표현을 연습해요' },
  { question: '처음에는 싫었는데, 나중에 생각이 바뀐 적이 있어? 왜 바뀌었어?', goal: '이유와 변화를 연습해요' },
];

/* ── 3.7 전용 아이콘 (에셋 design/아이콘_보호자 리포트/*.svg — 2026-08-16 슬랙 전달분) ──────────
   원본에 박힌 단색은 currentColor로 바꾸고 원래 색을 주석에 남긴다(icons.tsx 관례). *_disabled(#A89E93)·
   *_black 변형은 같은 패스의 색 차이라 컴포넌트 하나로 통합하고 사용처에서 색을 지정한다.
   공용 세트에 올리지 않고 지역 정의 (my-screen 관례 — 3.7 화면 전용). */

const ASSET = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** 겹말풍선 — 탭① 말하기 역량 분석 [에셋 chat, 원본 #FF7A3D / disabled #A89E93] */
function ChatIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...ASSET} strokeWidth={2}>
      <path d="M11.197 15.698C10.507 15.894 9.767 16 9 16C8.1114 16.0019 7.22867 15.8559 6.388 15.568L4 17V14.199C2.763 13.117 2 11.635 2 10C2 6.686 5.134 4 9 4C12.782 4 15.863 6.57 16 9.785V10.018M10 8H10.01M7 8H7.01M15 14H15.01M18 14H18.01M16.5 10C19.538 10 22 12.015 22 14.5C22 15.897 21.222 17.145 20 17.97V20L18.036 18.822C17.5327 18.9409 17.0172 19.0006 16.5 19C13.462 19 11 16.985 11 14.5C11 12.015 13.462 10 16.5 10Z" />
    </svg>
  );
}

/** 말풍선+별 — 탭② 대표 발화 [에셋 message_star, 원본 #FF7A3D / disabled #A89E93] */
function MessageStarIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...ASSET} strokeWidth={2}>
      <path d="M8.21059 8.66657H14.9475M8.21059 11.9998H12.0001M9.89483 16.9997L9.05271 16.1664H6.52635C5.85632 16.1664 5.21374 15.903 4.73995 15.4342C4.26617 14.9654 4 14.3295 4 13.6665V6.99994C4 6.33692 4.26617 5.70105 4.73995 5.23222C5.21374 4.76339 5.85632 4.5 6.52635 4.5H16.6318C17.3018 4.5 17.9444 4.76339 18.4182 5.23222C18.892 5.70105 19.1581 6.33692 19.1581 6.99994V10.7499M16.4636 18.5138L14.6345 19.4621C14.5802 19.4901 14.5191 19.5026 14.4581 19.4982C14.3971 19.4938 14.3385 19.4727 14.2889 19.4372C14.2392 19.4018 14.2006 19.3534 14.1771 19.2975C14.1537 19.2415 14.1464 19.1803 14.1561 19.1205L14.5056 17.1114L13.026 15.6889C12.9819 15.6466 12.9506 15.593 12.9358 15.534C12.921 15.475 12.9232 15.4131 12.9423 15.3553C12.9613 15.2975 12.9964 15.2462 13.0436 15.2072C13.0907 15.1682 13.1479 15.1431 13.2088 15.1347L15.2534 14.8414L16.168 13.0139C16.1953 12.9595 16.2375 12.9137 16.2897 12.8817C16.3419 12.8497 16.4021 12.8327 16.4636 12.8327C16.525 12.8327 16.5852 12.8497 16.6374 12.8817C16.6896 12.9137 16.7318 12.9595 16.7591 13.0139L17.6737 14.8414L19.7183 15.1347C19.779 15.1434 19.836 15.1686 19.8829 15.2077C19.9298 15.2467 19.9648 15.2979 19.9838 15.3556C20.0028 15.4133 20.0051 15.475 19.9905 15.5339C19.9759 15.5928 19.9449 15.6465 19.9011 15.6889L18.4215 17.1114L18.7701 19.1196C18.7806 19.1795 18.7739 19.2411 18.7507 19.2974C18.7276 19.3537 18.689 19.4025 18.6392 19.4381C18.5895 19.4738 18.5307 19.495 18.4694 19.4992C18.4081 19.5034 18.3469 19.4906 18.2926 19.4621L16.4636 18.5138Z" />
    </svg>
  );
}

/** 집+연필 — 탭③ 가정 학습 가이드·일상생활 섹션 [에셋 homeschooling, 원본 #FF7A3D / black #3A2C1E / disabled #A89E93] */
function HomeschoolIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...ASSET} strokeWidth={2}>
      <path d="M8.55127 18.1577V13.1051C8.55127 12.6585 8.72867 12.2301 9.04444 11.9142C9.3602 11.5984 9.78847 11.421 10.235 11.421H11.9188C12.4618 11.421 12.9442 11.6778 13.2523 12.0778M17.8119 9.73676L11.0769 3L3.5 10.5789H5.18376V16.4735C5.18376 16.9202 5.36115 17.3486 5.67692 17.6644C5.99268 17.9803 6.42096 18.1577 6.86752 18.1577H10.235M16.4818 13.619C16.646 13.4548 16.8409 13.3245 17.0554 13.2356C17.2699 13.1468 17.4998 13.101 17.732 13.101C17.9641 13.101 18.1941 13.1468 18.4086 13.2356C18.6231 13.3245 18.818 13.4548 18.9822 13.619C19.1463 13.7832 19.2766 13.9782 19.3654 14.1928C19.4543 14.4073 19.5 14.6373 19.5 14.8695C19.5 15.1018 19.4543 15.3317 19.3654 15.5463C19.2766 15.7609 19.1463 15.9558 18.9822 16.12L16.1282 19H13.6025V16.4737L16.4818 13.619Z" />
    </svg>
  );
}

/** 계단 막대 차트 — 월 리포트 필 [에셋 chartbar, 원본 #3A2C1E] */
function ChartBarIcon({ className = 'size-[18px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 22" className={className} aria-hidden {...ASSET} strokeWidth={2}>
      <path d="M4.125 17.875V11.6875H8.25" />
      <path d="M19.25 17.875H2.75" />
      <path d="M8.25 17.875V7.5625H13.0625" />
      <path d="M13.0625 17.875V3.4375H17.875V17.875" />
    </svg>
  );
}

/** 전구 — 한 줄 피드백·선정 이유·질문 도우미 [에셋 bulb_orange 22 원본 #FF7A3D; bulb_big 35·bulb_yellow 18은
    같은 글리프의 크기·색(#FFC93C) 변형이라 대표 패스로 통합] */
function BulbLineIcon({ className = 'size-4.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 22" className={className} aria-hidden {...ASSET} strokeWidth={2}>
      <path d="M1 11H2.11111M11 1V2.11111M19.8889 11H21M3.88889 3.88889L4.66667 4.66667M18.1111 3.88889L17.3333 4.66667M8.44358 16.5556H13.5547M7.66667 15.4444C6.73386 14.7448 6.04481 13.7695 5.69715 12.6565C5.34948 11.5435 5.36081 10.3494 5.72954 9.24318C6.09826 8.137 6.80569 7.17488 7.75161 6.4931C8.69753 5.81132 9.83399 5.44444 11 5.44444C12.166 5.44444 13.3025 5.81132 14.2484 6.4931C15.1943 7.17488 15.9017 8.137 16.2705 9.24318C16.6392 10.3494 16.6505 11.5435 16.3029 12.6565C15.9552 13.7695 15.2661 14.7448 14.3333 15.4444C13.8995 15.8739 13.5729 16.3994 13.3799 16.9785C13.1868 17.5576 13.1328 18.174 13.2222 18.7778C13.2222 19.3671 12.9881 19.9324 12.5713 20.3491C12.1546 20.7659 11.5894 21 11 21C10.4106 21 9.8454 20.7659 9.42865 20.3491C9.0119 19.9324 8.77778 19.3671 8.77778 18.7778C8.86717 18.174 8.81317 17.5576 8.62014 16.9785C8.42711 16.3994 8.10048 15.8739 7.66667 15.4444Z" />
    </svg>
  );
}

/** 여는/닫는 따옴표 — 대표 발화 카드 [에셋 quote_left·quote_right, 원본 #3A2C1E] */
function QuoteLeftIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...ASSET} strokeWidth={2}>
      <path d="M14 13L18 13C18.2652 13 18.5196 13.1054 18.7071 13.2929C18.8946 13.4804 19 13.7348 19 14L19 17C19 17.2652 18.8946 17.5196 18.7071 17.7071C18.5196 17.8946 18.2652 18 18 18L15 18C14.7348 18 14.4804 17.8946 14.2929 17.7071C14.1054 17.5196 14 17.2652 14 17L14 13ZM14 13L14 11C14 8.333 15.333 6.667 18 6M5 13L9 13C9.26522 13 9.51957 13.1054 9.70711 13.2929C9.89464 13.4804 10 13.7348 10 14L10 17C10 17.2652 9.89465 17.5196 9.70711 17.7071C9.51957 17.8946 9.26522 18 9 18L6 18C5.73479 18 5.48043 17.8946 5.29289 17.7071C5.10536 17.5196 5 17.2652 5 17L5 13ZM5 13L5 11C5 8.333 6.333 6.667 9 6" />
    </svg>
  );
}
function QuoteRightIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...ASSET} strokeWidth={2}>
      <path d="M10 11H6C5.73478 11 5.48043 10.8946 5.29289 10.7071C5.10536 10.5196 5 10.2652 5 10V7C5 6.73478 5.10536 6.48043 5.29289 6.29289C5.48043 6.10536 5.73478 6 6 6H9C9.26522 6 9.51957 6.10536 9.70711 6.29289C9.89464 6.48043 10 6.73478 10 7V11ZM10 11V13C10 15.667 8.667 17.333 6 18M19 11H15C14.7348 11 14.4804 10.8946 14.2929 10.7071C14.1054 10.5196 14 10.2652 14 10V7C14 6.73478 14.1054 6.48043 14.2929 6.29289C14.4804 6.10536 14.7348 6 15 6H18C18.2652 6 18.5196 6.10536 18.7071 6.29289C18.8946 6.48043 19 6.73478 19 7V11ZM19 11V13C19 15.667 17.667 17.333 15 18" />
    </svg>
  );
}

/** 어휘 Aa — 어휘 역량 원형 타일 [에셋 voca, 원본 #3DBE8B] */
function VocaIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...ASSET} strokeWidth={2}>
      <path d="M22 13V20M15 16.5C15 17.4283 15.3687 18.3185 16.0251 18.9749C16.6815 19.6313 17.5717 20 18.5 20C19.4283 20 20.3185 19.6313 20.9749 18.9749C21.6313 18.3185 22 17.4283 22 16.5C22 15.5717 21.6313 14.6815 20.9749 14.0251C20.3185 13.3687 19.4283 13 18.5 13C17.5717 13 16.6815 13.3687 16.0251 14.0251C15.3687 14.6815 15 15.5717 15 16.5Z" />
      <path d="M6.5 5L1 20.5" />
      <path d="M12.5 20.5C12.5 20.5 9.14788 11.0531 7 5" />
      <path d="M4 14L10 14" />
    </svg>
  );
}

/** 하트 아웃라인 — 표현 역량 원형 타일 [에셋 heart, 원본 #F262A0] */
function HeartIcon({ className = 'h-[19px] w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 19" className={className} aria-hidden {...ASSET} strokeWidth={2}>
      <path d="M17.513 9.58341L10.013 17.0114L2.513 9.58341C2.0183 9.10202 1.62864 8.52342 1.36854 7.88404C1.10845 7.24466 0.983558 6.55836 1.00173 5.86834C1.01991 5.17832 1.18076 4.49954 1.47415 3.87474C1.76755 3.24994 2.18713 2.69266 2.70648 2.23799C3.22583 1.78331 3.8337 1.4411 4.49181 1.23289C5.14991 1.02468 5.844 0.954991 6.53036 1.02821C7.21673 1.10143 7.8805 1.31596 8.47987 1.65831C9.07925 2.00066 9.60124 2.46341 10.013 3.01741C10.4265 2.46743 10.9491 2.00873 11.5481 1.67001C12.1471 1.3313 12.8095 1.11986 13.4939 1.04893C14.1784 0.977998 14.8701 1.04911 15.5258 1.2578C16.1815 1.46649 16.787 1.80828 17.3045 2.26177C17.8221 2.71526 18.2404 3.27069 18.5334 3.8933C18.8264 4.51591 18.9877 5.19229 19.0073 5.88012C19.0269 6.56794 18.9043 7.2524 18.6471 7.89066C18.39 8.52891 18.0039 9.10723 17.513 9.58941" />
    </svg>
  );
}

/** 펼친 책 — 이야기 주제 섹션 머리 [에셋 book_topic, 원본 #3A2C1E] */
function BookTopicIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden {...ASSET} strokeWidth={2}>
      <path d="M4.16699 15.0007C4.16699 15.4427 4.34259 15.8666 4.65515 16.1792C4.96771 16.4917 5.39163 16.6673 5.83366 16.6673H15.8337V3.33398H5.83366C5.39163 3.33398 4.96771 3.50958 4.65515 3.82214C4.34259 4.1347 4.16699 4.55862 4.16699 5.00065V15.0007ZM4.16699 15.0007C4.16699 14.5586 4.34259 14.1347 4.65515 13.8221C4.96771 13.5096 5.39163 13.334 5.83366 13.334H15.8337M7.50033 6.66732H12.5003" />
    </svg>
  );
}

/* 표현·논리 하위 항목 소형 글리프 — 원본이 소형 뷰박스(6~9px)라 스트로크 1이 확대 시 비율 유지된다 */

/** 눈 — 관점과 공감 [에셋 eye, 원본 #F262A0] */
function EyeIcon({ className = 'h-[9px] w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 11 6" className={className} aria-hidden {...ASSET} strokeWidth={1}>
      <path d="M4.38889 3C4.38889 3.22101 4.50595 3.43298 4.71433 3.58926C4.9227 3.74554 5.20531 3.83333 5.5 3.83333C5.79469 3.83333 6.0773 3.74554 6.28567 3.58926C6.49405 3.43298 6.61111 3.22101 6.61111 3C6.61111 2.77899 6.49405 2.56702 6.28567 2.41074C6.0773 2.25446 5.79469 2.16667 5.5 2.16667C5.20531 2.16667 4.9227 2.25446 4.71433 2.41074C4.50595 2.56702 4.38889 2.77899 4.38889 3Z" />
      <path d="M10.5 3C9.16667 4.66667 7.5 5.5 5.5 5.5C3.5 5.5 1.83333 4.66667 0.5 3C1.83333 1.33333 3.5 0.5 5.5 0.5C7.5 0.5 9.16667 1.33333 10.5 3Z" />
    </svg>
  );
}

/** 하트 채움 — 감정 표현 [에셋 heart_filled, 원본 #F262A0] */
function HeartFilledIcon({ className = 'h-[11px] w-[13px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 8" className={className} aria-hidden fill="currentColor" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 7C5 7 1 5.09091 1 2.84091C1 2.35267 1.21882 1.88443 1.60832 1.53919C1.99782 1.19395 2.52609 1 3.07692 1C3.94577 1 4.69 1.41966 5 2.09091C5.31 1.41966 6.05423 1 6.92308 1C7.47391 1 8.00218 1.19395 8.39168 1.53919C8.78118 1.88443 9 2.35267 9 2.84091C9 5.09091 5 7 5 7Z" />
    </svg>
  );
}

/** 양방향 화살표 — 상호작용 [에셋 arrow_interactive, 원본 #F262A0] */
function ArrowInteractiveIcon({ className = 'h-[11px] w-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 9 8" className={className} aria-hidden {...ASSET} strokeWidth={1}>
      <path d="M8.5 6.1875H0.5M7.16667 4.875L8.5 6.1875L7.16667 7.5M1.83333 0.5L0.5 1.8125L1.83333 3.125M0.5 1.8125H8.5" />
    </svg>
  );
}

/** 전구(소형) — 생각과 이유·논리 원형 타일 [에셋 bulb_blue, 원본 #4FA9E8] */
function BulbBlueIcon({ className = 'size-[13px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 9 9" className={className} aria-hidden {...ASSET} strokeWidth={1}>
      <path d="M0.5 4.5H0.944444M4.5 0.5V0.944444M8.05556 4.5H8.5M1.65556 1.65556L1.96667 1.96667M7.34444 1.65556L7.03333 1.96667M3.47743 6.72222H5.52188M3.16667 6.27778C2.79354 5.99793 2.51793 5.60779 2.37886 5.16259C2.23979 4.7174 2.24432 4.23974 2.39181 3.79727C2.53931 3.3548 2.82228 2.96995 3.20064 2.69724C3.57901 2.42453 4.03359 2.27778 4.5 2.27778C4.96641 2.27778 5.42099 2.42453 5.79936 2.69724C6.17772 2.96995 6.46069 3.3548 6.60818 3.79727C6.75568 4.23974 6.76021 4.7174 6.62114 5.16259C6.48207 5.60779 6.20646 5.99793 5.83333 6.27778C5.65981 6.44955 5.52915 6.65975 5.45194 6.89139C5.37473 7.12302 5.35313 7.36958 5.38889 7.61111C5.38889 7.84686 5.29524 8.07295 5.12854 8.23965C4.96184 8.40635 4.73575 8.5 4.5 8.5C4.26425 8.5 4.03816 8.40635 3.87146 8.23965C3.70476 8.07295 3.61111 7.84686 3.61111 7.61111C3.64687 7.36958 3.62527 7.12302 3.54806 6.89139C3.47085 6.65975 3.34019 6.44955 3.16667 6.27778Z" />
    </svg>
  );
}

/** 돋보기 — 결과와 해결 [에셋 magnifier, 원본 #4FA9E8] */
function MagnifierIcon({ className = 'size-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 8 8" className={className} aria-hidden {...ASSET} strokeWidth={1}>
      <path d="M7.5 7.5L5.16667 5.16667M0.5 3.22222C0.5 3.57971 0.570412 3.9337 0.707217 4.26397C0.844021 4.59425 1.04454 4.89434 1.29732 5.14712C1.5501 5.39991 1.8502 5.60042 2.18047 5.73723C2.51075 5.87403 2.86473 5.94444 3.22222 5.94444C3.57971 5.94444 3.9337 5.87403 4.26397 5.73723C4.59425 5.60042 4.89434 5.39991 5.14712 5.14712C5.39991 4.89434 5.60042 4.59425 5.73723 4.26397C5.87403 3.9337 5.94444 3.57971 5.94444 3.22222C5.94444 2.86473 5.87403 2.51075 5.73723 2.18047C5.60042 1.8502 5.39991 1.5501 5.14712 1.29732C4.89434 1.04454 4.59425 0.844021 4.26397 0.707217C3.9337 0.570412 3.57971 0.5 3.22222 0.5C2.86473 0.5 2.51075 0.570412 2.18047 0.707217C1.8502 0.844021 1.5501 1.04454 1.29732 1.29732C1.04454 1.5501 0.844021 1.8502 0.707217 2.18047C0.570412 2.51075 0.5 2.86473 0.5 3.22222Z" />
    </svg>
  );
}

const SUB_ICON = {
  eye: EyeIcon,
  heart: HeartFilledIcon,
  swap: ArrowInteractiveIcon,
  bulb: BulbBlueIcon,
  search: MagnifierIcon,
};

/* ── 화면 조각 ──────────────────────────────────────────────────────────── */

/** 성장 정도 점 5개 — 채움 수만큼 색, 나머지 #E8E2DA (시안 도트) */
function ScoreDots({ score, colorClass }: { score: number; colorClass: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5" role="img" aria-label={`성장 정도 5점 중 ${score}점`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`size-3 rounded-full ${i < score ? colorClass : 'bg-[#E8E2DA]'}`} />
      ))}
    </span>
  );
}

/** 역량 행 좌측 머리(원형 아이콘 + 역량명 + 요약) — 어휘/표현/논리 공통 */
function SkillHead({
  circleClass,
  nameClass,
  name,
  caption,
  children,
}: {
  circleClass: string;
  nameClass: string;
  name: string;
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full shrink-0 gap-3.5 md:w-[218px]">
      <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-full ${circleClass}`}>
        {children}
      </span>
      <div className="min-w-0">
        <p className={`text-[17px] font-bold ${nameClass}`}>{name}</p>
        <p className="mt-1 whitespace-pre-line text-[13px] leading-normal text-[#8A7A68]">{caption}</p>
      </div>
    </div>
  );
}

/** 표현·논리 하위 항목 행 — 아이콘 + 이름(볼드) + 설명 + 우측 도트 */
function SubSkillRow({ sub, tintClass, dotClass }: { sub: SubSkill; tintClass: string; dotClass: string }) {
  const Icon = SUB_ICON[sub.icon];
  return (
    <div className="flex items-center gap-3">
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-[#8A7A68]">
        <Icon className={`mr-1.5 inline size-4 align-[-2px] ${tintClass}`} />
        <span className={`mr-1 font-bold ${tintClass}`}>{sub.name}</span>
        {sub.desc}
      </p>
      <ScoreDots score={sub.score} colorClass={dotClass} />
    </div>
  );
}

/* ── 페이지 ─────────────────────────────────────────────────────────────── */

const TABS = [
  { key: 'analysis', no: 1, label: '말하기 역량 분석', Icon: ChatIcon },
  { key: 'utterances', no: 2, label: '대표 발화', Icon: MessageStarIcon },
  { key: 'guide', no: 3, label: '가정 학습 가이드', Icon: HomeschoolIcon },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export default async function ReportPage(props: PageProps<'/my/report'>) {
  const sp = await props.searchParams;
  const childId = typeof sp.child === 'string' ? sp.child : null;
  const tab: TabKey = sp.tab === 'utterances' || sp.tab === 'guide' ? sp.tab : 'analysis';

  const user = await getAuthedUser();
  if (!user) redirect('/login'); // proxy가 1차 차단 — 직접 렌더 경로 이중 방어

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('children')
    .select('id, name, avatar_key')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: true })
    .limit(3);
  if (error) throw new Error(`정보를 불러오지 못했습니다: ${error.message}`); // my/error.tsx 재시도

  // 리포트 대상 아이 — ?child= 컨텍스트의 아이, 없으면 첫째 (시안 우상단 칩은 표시 전용)
  const child = (data ?? []).find((row) => row.id === childId) ?? (data ?? [])[0] ?? null;
  const childName = child ? givenName(child.name as string) : null;
  const avatarKey = (child?.avatar_key as string | null) ?? null;

  // 월 표기 — 예시 리포트 1건이라 이번 달로 고정 표시 (향후 월간 확장 시 실제 목록으로 대체)
  const now = new Date();
  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월 리포트`;

  const tabHref = (key: TabKey) => {
    const params = new URLSearchParams();
    if (key !== 'analysis') params.set('tab', key);
    if (childId) params.set('child', childId);
    const query = params.toString();
    return query ? `/my/report?${query}` : '/my/report';
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* 헤더 — 3.1 계열 공통 스펙(81px·하단 보더)에 시안 3.7 요소: 타이틀 '보호자 리포트' + 우측 아이 칩 */}
      <header className="sticky top-0 z-40 border-b border-[#F0E4D3] bg-background">
        <div className="flex h-[81px] items-center px-6">
          <Link
            href={withChild('/my', childId)}
            aria-label="뒤로 가기"
            className="flex size-12 shrink-0 items-center justify-center text-ink active:opacity-70"
          >
            <ChevronLeftThinIcon className="h-[17px] w-[9px]" />
          </Link>
          <h1 className="text-[22px] font-bold text-ink">보호자 리포트</h1>
          {child && (
            <span className="ml-auto flex h-11 shrink-0 items-center gap-2 rounded-full border border-primary bg-[#FFEDE3] pl-1.5 pr-4">
              {avatarKey ? (
                <Image
                  src={avatarUrl(avatarKey as AvatarKey, 'select')}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 rounded-full bg-white object-cover object-top"
                />
              ) : (
                <UserIcon className="size-7 text-primary/70" />
              )}
              <span className="text-[15px] font-bold text-primary">{childName}</span>
            </span>
          )}
        </div>
      </header>

      {/* 월 표시 바 — 시안 우측 정렬 필(차트 글리프 + 라벨 + 꺾쇠). 리포트가 1건이라 전환 없는 표시 전용 */}
      <div className="border-b border-[#F0E4D3] bg-white">
        <div className="mx-auto flex h-[64px] w-full max-w-[1092px] items-center justify-end px-6">
          <span className="flex h-11 items-center gap-2 rounded-full border border-[#E8E2DA] bg-white px-4 text-[15px] font-bold text-ink">
            <ChartBarIcon className="size-[18px]" />
            {monthLabel}
            <ChevronDownIcon className="size-3 text-ink" />
          </span>
        </div>
      </div>

      {/* 탭 3분할 — 번호 배지 + 글리프 + 라벨, 활성은 primary 텍스트·밑줄 (3.5 탭과 같은 ?tab= 서버 전환) */}
      <nav className="bg-white">
        <div className="mx-auto flex w-full max-w-[1092px]">
          {TABS.map(({ key, no, label, Icon }) => {
            const active = key === tab;
            const inner = (
              <>
                <span
                  aria-hidden
                  className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                    active ? 'bg-primary' : 'bg-[#C4B49F]'
                  }`}
                >
                  {no}
                </span>
                <Icon className="size-5" />
                {label}
              </>
            );
            return active ? (
              <span
                key={key}
                aria-current="true"
                className="flex h-14 flex-1 items-center justify-center gap-2 border-b-[3px] border-primary text-base font-bold text-primary"
              >
                {inner}
              </span>
            ) : (
              <Link
                key={key}
                href={tabHref(key)}
                replace
                className="flex h-14 flex-1 items-center justify-center gap-2 border-b border-[#E8E2DA] text-base font-bold text-[#8A7A68] active:bg-background"
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-[1092px] flex-1 px-6 pb-12 pt-7">
        {child === null ? (
          // 등록된 아이가 없으면 분석 대상이 없다 — 3.1 빈 상태 관례로 프로필 등록 유도
          <section className="mt-8 flex flex-col items-center gap-4 rounded-3xl bg-white p-10">
            <p className="text-base text-ink/70">등록된 아이 프로필이 없습니다</p>
            <Link
              href="/my/profiles"
              className="flex h-12 items-center rounded-full bg-primary px-6 text-base font-bold text-white active:bg-ink"
            >
              ＋ 아이 추가
            </Link>
          </section>
        ) : tab === 'analysis' ? (
          <section>
            <h2 className="text-lg font-bold text-ink">1. 말하기 역량 분석</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#8A7A68]">
              활동에서 나타난 특징과 성장 포인트를 알려드려요.
              <br />
              아이가 자주 드러내고 발전시키는 강점 역량을 기반으로 분석했어요.
            </p>

            {/* 한 줄 피드백 — 노랑 배너 */}
            <div className="mt-6 flex gap-3 rounded-2xl bg-[#FFF5D4] px-5 py-4">
              <p className="shrink-0 pt-px text-[15px] font-bold text-primary">
                <BulbLineIcon className="mr-1 inline size-4.5 align-[-3px]" />한 줄 피드백
              </p>
              <div className="min-w-0 text-sm leading-relaxed text-ink">
                {ONE_LINE_FEEDBACK.map((line) => (
                  <p key={line.slice(0, 8)}>{line}</p>
                ))}
              </div>
            </div>

            {/* 역량 카드 — 어휘/표현/논리 3행, 행 구분선 */}
            <div className="mt-5 rounded-2xl bg-white shadow-[0_4px_18px_rgba(58,44,30,0.06)]">
              {/* 어휘 */}
              <div className="flex flex-col gap-5 p-6 md:flex-row">
                <SkillHead circleClass="bg-[#DDF5EC] text-sage" nameClass="text-sage" name="어휘" caption={VOCAB.caption}>
                  <VocaIcon className="size-5" />
                </SkillHead>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink">주요 사용 단어</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {VOCAB.words.map((word) => (
                      <span key={word} className="rounded-lg border border-[#E8E2DA] bg-white px-2.5 py-1 text-[13px] text-ink">
                        {word}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-sm font-bold text-ink">피드백</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#8A7A68]">{VOCAB.feedback}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 md:flex-col md:items-end md:gap-2">
                  <p className="text-[13px] text-[#8A7A68]">성장 정도</p>
                  <ScoreDots score={VOCAB.score} colorClass="bg-sage" />
                </div>
              </div>

              {/* 표현 */}
              <div className="flex flex-col gap-5 border-t border-[#F0E4D3] p-6 md:flex-row">
                <SkillHead
                  circleClass="bg-berry/10 text-berry"
                  nameClass="text-berry"
                  name="표현"
                  caption={EXPRESSION.caption}
                >
                  <HeartIcon className="h-[19px] w-5" />
                </SkillHead>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
                  {EXPRESSION.subs.map((sub) => (
                    <SubSkillRow key={sub.name} sub={sub} tintClass="text-berry" dotClass="bg-berry" />
                  ))}
                </div>
              </div>

              {/* 논리 */}
              <div className="flex flex-col gap-5 border-t border-[#F0E4D3] p-6 md:flex-row">
                <SkillHead circleClass="bg-[#DDF0FB] text-sky" nameClass="text-sky" name="논리" caption={LOGIC.caption}>
                  <BulbBlueIcon className="size-5" />
                </SkillHead>
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
                  {LOGIC.subs.map((sub) => (
                    <SubSkillRow key={sub.name} sub={sub} tintClass="text-sky" dotClass="bg-sky" />
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : tab === 'utterances' ? (
          <section>
            <h2 className="text-lg font-bold text-ink">2. 대표 발화</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#8A7A68]">
              {substituteChildName('이야기의 핵심 장면에서 ㅇㅇ이가 가장 잘 표현한 말이에요.', childName)}
            </p>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {UTTERANCES.map(({ quote, reason }) => (
                <article key={quote.slice(0, 10)} className="rounded-2xl bg-white p-6 shadow-[0_4px_18px_rgba(58,44,30,0.06)]">
                  <div aria-hidden className="flex justify-between text-ink">
                    <QuoteLeftIcon className="size-6" />
                    <QuoteRightIcon className="size-6" />
                  </div>
                  <p className="mx-auto -mt-1 max-w-[420px] whitespace-pre-line text-center text-[17px] font-bold leading-relaxed text-ink">
                    {quote}
                  </p>
                  <p className="mt-5 rounded-xl bg-[#FFF5D4] px-4 py-3 text-sm leading-relaxed text-[#8A7A68]">
                    <BulbLineIcon className="mr-1 inline size-4 align-[-2px] text-primary" />
                    <span className="mr-1.5 font-bold text-primary">선정 이유</span>
                    {reason}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section>
            <h2 className="text-lg font-bold text-ink">3. 집에서 이렇게 이야기해보세요</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#8A7A68]">
              이야기를 더 깊게 생각하고, 일상과 연결해 볼 수 있어요. 아이의 이야기를 끝까지 듣고, 이유와 감정을 한 번 더
              물어봐 주세요.
            </p>

            {/* 이야기 주제 이야기하기 — 주황 번호·노랑 학습 목표 */}
            <p className="mt-6 flex items-center gap-2 text-[15px] font-bold text-ink">
              <BookTopicIcon className="size-5" />
              이야기 주제 이야기하기
            </p>
            <div className="mt-3 grid gap-6 md:grid-cols-2">
              {GUIDE_STORY.map(({ question, goal }, i) => (
                <article key={question} className="rounded-2xl bg-white p-6 shadow-[0_4px_18px_rgba(58,44,30,0.06)]">
                  <span
                    aria-hidden
                    className="flex size-8 items-center justify-center rounded-full bg-primary text-[15px] font-bold text-white"
                  >
                    {i + 1}
                  </span>
                  <p className="mt-3 text-[15px] font-bold text-ink">{question}</p>
                  <p className="mt-3 rounded-xl bg-[#FFF5D4] px-4 py-2.5 text-[13px] text-[#8A7A68]">
                    <span className="mr-2 font-bold text-primary">학습 목표</span>
                    {goal}
                  </p>
                </article>
              ))}
            </div>

            {/* 일상생활로 연결하기 — 초록 번호(이어지는 3·4)·민트 학습 목표 */}
            {/* 섹션 머리 집 아이콘 — homeschooling_black(#3A2C1E) 변형: 같은 글리프에 잉크색 지정 */}
            <p className="mt-7 flex items-center gap-2 text-[15px] font-bold text-ink">
              <HomeschoolIcon className="size-5" />
              일상생활로 연결하기
            </p>
            <div className="mt-3 grid gap-6 md:grid-cols-2">
              {GUIDE_DAILY.map(({ question, goal }, i) => (
                <article key={question} className="rounded-2xl bg-white p-6 shadow-[0_4px_18px_rgba(58,44,30,0.06)]">
                  <span
                    aria-hidden
                    className="flex size-8 items-center justify-center rounded-full bg-sage text-[15px] font-bold text-white"
                  >
                    {i + 3}
                  </span>
                  <p className="mt-3 text-[15px] font-bold text-ink">{question}</p>
                  <p className="mt-3 rounded-xl bg-[#DDF5EC] px-4 py-2.5 text-[13px] text-[#8A7A68]">
                    <span className="mr-2 font-bold text-sage">학습 목표</span>
                    {goal}
                  </p>
                </article>
              ))}
            </div>

            {/* 질문 도우미 배너 — 맞춤 가이드는 미구현 기능이라 이동 없는 버튼 (3.1 보호자 리포트 버튼과 같은 관례) */}
            <div className="mt-7 flex flex-wrap items-center gap-4 rounded-2xl border border-sage bg-[#EFF9F4] px-6 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-sage">
                  {/* 배너 전구 — 에셋 bulb_big 원색 Sunny(#FFC93C) */}
                  <BulbLineIcon className="mr-1.5 inline size-4.5 align-[-3px] text-sunny" />
                  질문 도우미가 필요하신가요?
                </p>
                <p className="mt-1 text-sm text-[#8A7A68]">
                  아이의 반응 유형별 맞춤 대화 가이드를 받아보세요. 대화가 훨씬 쉬워집니다.
                </p>
              </div>
              <button
                type="button"
                className="h-11 shrink-0 rounded-xl bg-sage px-5 text-[15px] font-bold text-white active:opacity-80"
              >
                맞춤 가이드 받기
              </button>
            </div>
          </section>
        )}
      </main>

      <BottomNav active="my" childId={childId} />
    </div>
  );
}
