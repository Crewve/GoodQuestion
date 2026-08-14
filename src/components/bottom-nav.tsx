// 하단 GNB (기능명세서 2.0/2.2/3.1 공통) — 홈·이야기·단어장·마이페이지.
// 단어장은 MVP 이동 없음(기능명세서 명시). 아이 컨텍스트(child 쿼리)는 링크에 그대로 전파한다.
// Server Component — 눌림 효과는 CSS active로 충분해 클라이언트 코드 불필요.
// 아이콘은 피그마 BottomGNB 단색 글리프를 인라인 SVG로 재현 — currentColor라
// 활성 primary/비활성 #C4B49F 틴트가 라벨과 함께 아이콘에도 적용된다.
import Link from 'next/link';
import type { ComponentType } from 'react';

type Tab = 'home' | 'stories' | 'wordbook' | 'my';

/** 아이 컨텍스트(child 쿼리) 보존 링크 — GNB와 my 계열 내부 링크가 공통 사용해 왕복 내내 유지한다 (A3) */
export function withChild(href: string, childId: string | null): string {
  return childId ? `${href}?child=${encodeURIComponent(childId)}` : href;
}

type IconProps = { className?: string };

function HomeIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 3 3.6 10.3V20a1 1 0 0 0 1 1H10v-5.6h4V21h5.4a1 1 0 0 0 1-1v-9.7L12 3z" />
    </svg>
  );
}

function BookIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M11.2 6.2C9.7 4.9 7.6 4.3 5 4.3c-.9 0-1.7.1-2.5.3v13.6c.8-.2 1.6-.3 2.5-.3 2.6 0 4.7.7 6.2 2V6.2z" />
      <path d="M12.8 6.2c1.5-1.3 3.6-1.9 6.2-1.9.9 0 1.7.1 2.5.3v13.6c-.8-.2-1.6-.3-2.5-.3-2.6 0-4.7.7-6.2 2V6.2z" />
    </svg>
  );
}

function NoteIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.5 2.5A1.5 1.5 0 0 0 5 4v16a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 20V8l-5.5-5.5h-7zm7.2 1.7 3.6 3.6h-3.6V4.2zM8 11.4h8v1.8H8v-1.8zm0 4h5.5v1.8H8v-1.8z"
      />
    </svg>
  );
}

function PersonIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 12a4.3 4.3 0 1 0 0-8.6 4.3 4.3 0 0 0 0 8.6zm0 2c-4 0-7.3 2.3-7.3 5.1 0 .9.7 1.6 1.6 1.6h11.4c.9 0 1.6-.7 1.6-1.6 0-2.8-3.3-5.1-7.3-5.1z" />
    </svg>
  );
}

const TABS: { key: Tab; label: string; Icon: ComponentType<IconProps>; href: (child: string | null) => string | null }[] = [
  { key: 'home', label: '홈', Icon: HomeIcon, href: (c) => withChild('/home', c) },
  { key: 'stories', label: '이야기', Icon: BookIcon, href: (c) => withChild('/stories', c) },
  { key: 'wordbook', label: '단어장', Icon: NoteIcon, href: () => null }, // 이동 없음 (MVP)
  { key: 'my', label: '마이페이지', Icon: PersonIcon, href: (c) => withChild('/my', c) },
];

export function BottomNav({ active, childId }: { active: Tab; childId: string | null }) {
  // 피그마 BottomGNB: 흰 배경·상단 보더 #F0E4D3·활성 #FF7A3D/비활성 #C4B49F·아이콘+라벨 수직.
  // 화면 하단 고정 (QA 21) — sticky bottom-0은 컨테이너 마지막 자식이라 붙을 여백이 없어
  // 세로 스크롤 화면(마이페이지 계열)에서 끝까지 내려야만 보였다. fixed로 바꾸고
  // 흐름에는 같은 높이(h-14)의 스페이서를 남겨 기존 레이아웃 계산(h-dvh 화면의 잔여 높이)을 유지한다.
  return (
    <div className="mt-auto h-14 shrink-0">
      <nav
        aria-label="주요 메뉴"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#F0E4D3] bg-white shadow-[0_-4px_20px_rgba(58,44,30,0.08)]"
      >
        {TABS.map((tab) => {
          const href = tab.href(childId);
          const isActive = tab.key === active;
          const className = `flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-lg leading-tight font-semibold ${
            isActive ? 'text-primary' : 'text-[#C4B49F]'
          } active:bg-background`;
          const body = (
            <>
              <tab.Icon />
              {tab.label}
            </>
          );
          // 현재 탭·단어장은 이동 없음 — 버튼으로 렌더
          if (isActive || !href) {
            return (
              <button key={tab.key} type="button" aria-current={isActive ? 'page' : undefined} className={className}>
                {body}
              </button>
            );
          }
          return (
            <Link key={tab.key} href={href} className={className}>
              {body}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
