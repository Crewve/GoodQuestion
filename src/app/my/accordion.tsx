// 마이페이지 계열 공용 UI (T058 → UI 리뉴얼 E, 피그마 「개발 배포용」 3.1~3.5 공통 요소).
// ① MyPageHeader — 상단 고정 헤더(「마이페이지」 타이틀 + 뒤로가기), 핸드오프 §2.1 Header 상시 노출.
// ② AccordionList/AccordionItem — 3.3~3.5 "항목 클릭 시 같은 화면에서 내용 표시".
//    네이티브 <details>/<summary>라 클라이언트 JS 불필요 — Server Component에서 그대로 사용.
// ③ ChildProfileCard — 3.1 '등록된 아이' 카드(팔레트 3종 순환). 3.2 프로필 관리도 같은 스타일 준용.
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { ChildProfile } from '@/app/profiles/profiles-screen';
import { avatarUrl, type AvatarKey } from '@/lib/assets';
import { koreanAge } from '@/lib/profile-display';

/** 상단 고정 헤더 — 피그마 공통 스펙: 높이 81, bg Base, 하단 보더 #F0E4D3, 타이틀 22px Bold(좌측 72 정렬) */
export function MyPageHeader({ backHref }: { backHref?: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[#F0E4D3] bg-background">
      <div className="flex h-[81px] items-center px-6">
        {backHref ? (
          <Link
            href={backHref}
            aria-label="뒤로 가기"
            className="flex size-12 shrink-0 items-center justify-center text-2xl text-ink active:opacity-70"
          >
            ‹
          </Link>
        ) : (
          // 시안 공통: 뒤로가기 없는 화면도 타이틀은 좌측 72px 정렬 (빈 슬롯 유지)
          <span aria-hidden className="size-12 shrink-0" />
        )}
        <h1 className="text-[22px] font-bold text-ink">마이페이지</h1>
      </div>
    </header>
  );
}

type AccordionItemProps = {
  title: string;
  /** 제목 아래 보조 텍스트 (공지 날짜 등) */
  meta?: string;
  /** 왼쪽 아이콘 타일 (3.5 이용 가이드 카드) — 52px 라운드 타일에 이모지 표시 */
  icon?: ReactNode;
  /** 펼침 본문 톤 — muted: FAQ 답변(14px 회갈색) / body: 공지·약관 본문(15px 진회색) */
  tone?: 'muted' | 'body';
  /** true면 항목 자체가 독립 카드 (3.4 FAQ·3.5 가이드) — false면 목록 카드 내부 행 (3.3 공지) */
  separated?: boolean;
  children: ReactNode;
};

export function AccordionItem({ title, meta, icon, tone = 'muted', separated = false, children }: AccordionItemProps) {
  return (
    <details
      className={
        separated
          ? 'group overflow-hidden rounded-[14px] border border-[#E8E2DA] bg-white'
          : 'group border-b border-[#E8E2DA] last:border-b-0'
      }
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-4 px-5 py-[18px] active:bg-background [&::-webkit-details-marker]:hidden">
        {icon && (
          <span aria-hidden className="flex size-[52px] shrink-0 items-center justify-center rounded-[14px] bg-[#FFEDE3] text-2xl">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-[#1E1A14]">{title}</span>
          {meta && <span className="mt-1 block text-[13px] text-[#7A7268]">{meta}</span>}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          fill="none"
          className="size-4 shrink-0 text-[#7A7268] transition-transform group-open:rotate-180"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div
        className={`whitespace-pre-line border-t border-[#E8E2DA] px-5 py-4 ${
          tone === 'body' ? 'text-[15px] leading-[1.8] text-[#1E1A14]' : 'text-sm leading-relaxed text-[#7A7268]'
        }`}
      >
        {children}
      </div>
    </details>
  );
}

/** 목록 컨테이너 — separated: 카드 분리형(간격 10px, 3.4·3.5) / 기본: 한 카드에 행 구분선(3.3) */
export function AccordionList({ children, separated = false }: { children: ReactNode; separated?: boolean }) {
  if (separated) return <section className="flex flex-col gap-2.5">{children}</section>;
  return <section className="overflow-hidden rounded-2xl border border-[#E8E2DA] bg-white">{children}</section>;
}

const AVATAR_KEYS = new Set<string>(['boy-1', 'boy-2', 'girl-1', 'girl-2']);

// 3.1 Case B 카드 팔레트 순환 — 피치(Primary)→핑크(Berry)→옐로(Sunny).
// Sunny 배지만 텍스트를 ink로 — 시안의 흰 글자는 대비 미달(하한선 4.5:1 보정).
const CARD_PALETTES = [
  {
    bg: 'bg-[#FFEDE3]',
    badge: 'bg-primary text-white',
    circleShadow: 'shadow-[0_6px_20px_rgba(255,122,61,0.25)]',
    sparkle: 'text-primary',
  },
  {
    bg: 'bg-[#FDDCEF]',
    badge: 'bg-berry text-white',
    circleShadow: 'shadow-[0_6px_20px_rgba(242,98,160,0.25)]',
    sparkle: 'text-berry',
  },
  {
    bg: 'bg-[#FFF5D4]',
    badge: 'bg-sunny text-ink',
    circleShadow: 'shadow-[0_6px_20px_rgba(255,201,60,0.25)]',
    sparkle: 'text-sunny',
  },
] as const;

type ChildProfileCardProps = {
  profile: ChildProfile;
  /** 표시 이름 — 3.1은 성 제외(givenName), 3.2는 전체 이름 */
  displayName: string;
  /** 카드 순번 — 팔레트 순환 기준 */
  index: number;
  /** 만 나이 배지 노출 여부 (3.2 관리 모드에서는 숨김 — 기존 규칙 유지) */
  showAge?: boolean;
  /** 카드 하단 추가 요소 (3.2 관리 모드의 수정·삭제 버튼) */
  footer?: ReactNode;
};

export function ChildProfileCard({ profile, displayName, index, showAge = true, footer }: ChildProfileCardProps) {
  const palette = CARD_PALETTES[index % CARD_PALETTES.length];
  const age = koreanAge(profile.birthDate);
  const hasAvatar = !!profile.avatarKey && AVATAR_KEYS.has(profile.avatarKey);
  return (
    <li
      className={`flex flex-col items-center gap-4 rounded-[28px] px-4 pb-6 pt-7 shadow-[0_4px_18px_rgba(58,44,30,0.10)] ${palette.bg}`}
    >
      <span className={`relative flex size-[110px] shrink-0 items-center justify-center rounded-full bg-white ${palette.circleShadow}`}>
        {hasAvatar ? (
          <Image
            src={avatarUrl(profile.avatarKey as AvatarKey, 'select')}
            alt=""
            width={82}
            height={79}
            className="size-[82px] object-contain"
          />
        ) : (
          <span aria-hidden className="text-4xl">
            🙂
          </span>
        )}
        <span aria-hidden className="absolute -top-1.5 right-0 text-sm text-sunny">
          ★
        </span>
        <span aria-hidden className={`absolute -left-1 top-1 text-[10px] ${palette.sparkle}`}>
          ✦
        </span>
      </span>
      <span className="flex max-w-full items-center gap-2">
        <span className="min-w-0 truncate text-2xl font-bold text-ink">{displayName}</span>
        {showAge && age !== null && (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${palette.badge}`}>만 {age}세</span>
        )}
      </span>
      {footer}
    </li>
  );
}
