// 하단 GNB (기능명세서 2.0/2.2/3.1 공통) — 홈·이야기·단어장·마이페이지.
// 단어장은 MVP 이동 없음(기능명세서 명시). 아이 컨텍스트(child 쿼리)는 링크에 그대로 전파한다.
// Server Component — 눌림 효과는 CSS active로 충분해 클라이언트 코드 불필요.
import Link from 'next/link';

type Tab = 'home' | 'stories' | 'wordbook' | 'my';

const TABS: { key: Tab; label: string; icon: string; href: (child: string | null) => string | null }[] = [
  { key: 'home', label: '홈', icon: '🏠', href: (c) => (c ? `/home?child=${c}` : '/home') },
  { key: 'stories', label: '이야기', icon: '📖', href: (c) => (c ? `/stories?child=${c}` : '/stories') },
  { key: 'wordbook', label: '단어장', icon: '📒', href: () => null }, // 이동 없음 (MVP)
  { key: 'my', label: '마이페이지', icon: '👤', href: () => '/my' },
];

export function BottomNav({ active, childId }: { active: Tab; childId: string | null }) {
  // 피그마 BottomGNB: 흰 배경·상단 보더 #F0E4D3·활성 #FF7A3D/비활성 #C4B49F·아이콘+라벨 수직
  return (
    <nav
      aria-label="주요 메뉴"
      className="sticky bottom-0 mt-auto flex border-t border-[#F0E4D3] bg-white shadow-[0_-4px_20px_rgba(58,44,30,0.08)]"
    >
      {TABS.map((tab) => {
        const href = tab.href(childId);
        const isActive = tab.key === active;
        const className = `flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-lg leading-tight font-semibold ${
          isActive ? 'text-primary' : 'text-[#C4B49F]'
        } active:bg-base`;
        const body = (
          <>
            <span aria-hidden className="text-xl">
              {tab.icon}
            </span>
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
  );
}
