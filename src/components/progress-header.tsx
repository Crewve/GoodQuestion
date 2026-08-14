'use client';
// 진행 공통 헤더 (T035, 기능명세서 2.4.1~2.4.3 공통) — 피그마 「개발 배포용」 2.4 이야기 진행_헤더 대조.
// 좌: 나가기 알약 버튼(X 아이콘+텍스트), 우: n/N 텍스트 + 프로그레스 바. 시안에는 제목 미노출 — sr-only로 유지.
// n은 컨테이너가 계산해 내려준다: 도입 동안 1 고정, 전개k/대화k 진입 시 k (문장 인덱스와 무관 — 2.4.1·2.4.2).
// 터치 48px+·본문 18px+ (핸드오프 가이드 아동 화면 조항).

type ProgressHeaderProps = {
  title: string;
  n: number;
  N: number;
  onExit: () => void;
};

function XIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden fill="none">
      <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function ProgressHeader({ title, n, N, onExit }: ProgressHeaderProps) {
  const percent = N > 0 ? Math.min(100, Math.round((n / N) * 100)) : 0;
  return (
    <header className="flex h-20 shrink-0 items-center justify-between gap-4 px-6">
      <button
        type="button"
        onClick={onExit}
        aria-label="이야기 나가기"
        className="flex h-12 shrink-0 items-center gap-2.5 rounded-full bg-white pr-6 pl-5 font-display text-2xl text-ink shadow-[0_3px_10px_rgba(0,0,0,0.25)] active:bg-ink active:text-white"
      >
        <XIcon />
        나가기
      </button>
      {/* 시안(2.4.1·2.4.2 헤더)에는 이야기 제목 미노출 — 접근성용으로만 유지 */}
      <h1 className="sr-only">{title}</h1>
      <div className="flex shrink-0 items-center gap-4">
        {/* 시안 #8A7A68은 Base 배경 대비 3.9:1 — 아동 하한 4.5:1 충족 위해 ink/70로 상향 */}
        <span className="font-display text-[22px] text-ink/70" aria-label={`진행률 ${n}/${N}`}>
          {n}/{N}
        </span>
        <div
          className="h-6 w-28 overflow-hidden rounded-full bg-[#8a7a68]/12 sm:w-[174px]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-xs bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </header>
  );
}
