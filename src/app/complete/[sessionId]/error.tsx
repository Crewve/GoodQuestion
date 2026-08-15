'use client';
// 학습 완료 화면 조회 실패 (기능명세서 2.5 예외) — "다시 시도"로 현재 화면 유지 후 재조회.
// 스타일은 stories/error.tsx 패턴(아이 화면 — Cafe24·주황 알약 버튼) 재사용.
export default function CompleteError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <p className="font-display text-2xl text-ink">이야기 정보를 불러오지 못했습니다</p>
      <button
        type="button"
        onClick={reset}
        className="h-[55px] rounded-full bg-primary px-8 font-display text-xl font-bold text-white shadow-[0_5px_10px_rgba(255,122,61,0.33)] active:opacity-90"
      >
        다시 시도
      </button>
    </main>
  );
}
