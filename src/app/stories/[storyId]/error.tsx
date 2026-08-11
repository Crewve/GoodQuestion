'use client';
// 이야기 상세 조회 실패 (기능명세서 2.3 예외) — "다시 시도" 버튼으로 재요청.
export default function StoryDetailError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold text-ink">이야기 정보를 불러오지 못했습니다</p>
      <button
        type="button"
        onClick={reset}
        className="h-12 rounded-full bg-primary px-6 font-semibold text-white"
      >
        다시 시도
      </button>
    </main>
  );
}
