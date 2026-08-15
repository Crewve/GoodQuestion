'use client';
// 학습완료 활동(2.4.4·2.4.5) 데이터 조회 실패 — "다시 시도"로 현재 화면 유지 후 재조회.
// 전용 문구가 명세에 없어 가장 가까운 2.5 조회 실패 문구를 공용. 스타일은 stories/error.tsx 패턴.
export default function ActivityError({ reset }: { reset: () => void }) {
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
