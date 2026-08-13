'use client';
// 이야기 상세 조회 실패 (기능명세서 2.3 예외) — "다시 시도" 버튼으로 재요청.
// UI 리뉴얼 (피그마 2.3 톤 대조): base 배경·Cafe24 헤드라인·주황 알약 버튼(r48·주황 그림자).
export default function StoryDetailError({ reset }: { reset: () => void }) {
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
