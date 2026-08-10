'use client';
// 진행 공통 헤더 (T035, 기능명세서 2.4.1~2.4.3 공통) — 제목·진행률 텍스트 n/N·프로그레스 바·X 나가기.
// n은 컨테이너가 계산해 내려준다: 도입 동안 1 고정, 전개k/대화k 진입 시 k (문장 인덱스와 무관 — 2.4.1·2.4.2).
// 터치 44px+·본문 18px+ (핸드오프 가이드 아동 화면 조항).

type ProgressHeaderProps = {
  title: string;
  n: number;
  N: number;
  onExit: () => void;
};

export function ProgressHeader({ title, n, N, onExit }: ProgressHeaderProps) {
  const percent = N > 0 ? Math.min(100, Math.round((n / N) * 100)) : 0;
  return (
    <header className="flex items-center gap-4 px-4 py-3">
      <button
        type="button"
        onClick={onExit}
        aria-label="이야기 나가기"
        className="flex size-12 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-ink active:bg-ink active:text-white"
      >
        ✕
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="truncate font-display text-lg text-ink">{title}</h1>
          <span className="shrink-0 text-lg font-semibold text-ink" aria-label={`진행률 ${n}/${N}`}>
            {n}/{N}
          </span>
        </div>
        <div
          className="mt-1 h-3 overflow-hidden rounded-full bg-white"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>
    </header>
  );
}
