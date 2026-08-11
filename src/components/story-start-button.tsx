'use client';
// 이야기 시작하기 → 세션 연결 (T050, 기능명세서 2.3)
// POST /api/sessions(멱등 — 진행 세션 있으면 반환, 없으면 생성)로 sessionId를 얻어
// /play/[sessionId]?child&story 로 이동한다. 재개/신규 분기는 서버(재개 지점 계산)가 담당.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function StoryStartButton({ storyId, childId }: { storyId: string; childId: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    if (loading) return;
    if (!childId) {
      router.push('/profiles'); // 아이 컨텍스트 없음 → 프로필 선택(2.1, T047)
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ childId, storyId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `이야기를 시작하지 못했어요 (HTTP ${res.status})`);
      }
      const { sessionId } = (await res.json()) as { sessionId: string };
      router.push(`/play/${sessionId}?child=${childId}&story=${storyId}`);
      // 라우팅 후에도 버튼은 로딩 유지 — 전환 중 재클릭 방지
    } catch (e) {
      setError(e instanceof Error ? e.message : '이야기를 시작하지 못했어요.');
      setLoading(false);
    }
  };

  return (
    <div className="mt-auto flex flex-col gap-2 pb-4">
      {error && (
        <p role="alert" className="text-center text-sm font-semibold text-berry">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="h-14 w-full rounded-2xl bg-primary text-lg font-bold text-white active:opacity-90 disabled:opacity-60"
      >
        {loading ? '이야기를 준비하고 있어요…' : '이야기 시작하기'}
      </button>
    </div>
  );
}
