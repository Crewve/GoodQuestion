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

  // UI 리뉴얼 (피그마 2.3): 알약 CTA(r48·h55·주황 그림자), 라벨 '이야기 하러가기'.
  // 스토리보드 최신 시안 = primary 채움 + 흰 글자 20px (피그마 코멘트 #107 — QA 5의 흰 바탕 버전 철회.
  // 흰 글자 대비 2.6:1 미달은 인지하고 시안값 채택).
  // 에러 문구는 18px 하한·대비 4.5:1 하한 준수(#9F1239 — 시안 berry 원색은 2.8:1 미달).
  return (
    <div className="mt-auto flex shrink-0 flex-col gap-2 pt-4 pb-4">
      {error && (
        <p role="alert" className="text-center text-lg font-semibold text-[#9F1239]">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="h-[55px] w-full rounded-full bg-primary font-display text-xl font-bold text-white shadow-[0_5px_10px_rgba(255,122,61,0.33)] active:opacity-90 disabled:opacity-60"
      >
        {loading ? '이야기를 준비하고 있어요…' : '이야기 하러가기'}
      </button>
    </div>
  );
}
