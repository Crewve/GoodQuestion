'use client';
// 마이페이지 조회 실패 (기능명세서 3.1 "정보를 불러오지 못했습니다" — 3.2 프로필 조회 실패도
// 같은 경계에서 재시도) — 2.2 stories/error.tsx와 동일 패턴.
export default function MyError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-lg font-semibold text-ink">정보를 불러오지 못했습니다</p>
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
