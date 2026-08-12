'use client';
// 학습완료 활동 흐름 (T055) — 2.4.4 카드 배열(T053) → 2.4.5 재구성 발화(T054) 전환과
// /api/post-activity(T052) 호출을 소유한다. 화면 컴포넌트의 접점은 콜백뿐(판정·저장은 서버).
// 헤더는 진행 헤더(T035) 재사용 — "학습완료 전체 2단계 중 n단계"를 n/N으로 표시.
// X 나가기: 저장 없이 종료 → 2.3 이야기 상세(2.4.4 화면 이동 — 재진입 라우팅은 서버 저장값 기준).
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CardOrdering, type PostActivityCard } from '@/components/card-ordering';
import { ProgressHeader } from '@/components/progress-header';
import { Retelling } from '@/components/retelling';

export type PostActivityStep = 'card-order' | 'retelling';

type PostActivityFlowProps = {
  sessionId: string;
  storyId: string;
  storyTitle: string;
  /** 정답 순서로 정렬된 카드 4장 — 무작위 제시는 CardOrdering 내부 몫 */
  cards: PostActivityCard[];
  /** cards와 인덱스 쌍 핵심 단어 4개 (2.4.5 4세트) */
  keywords: string[];
  /** 재진입 라우팅 결과 — is_order_correct=true면 2.4.5부터 (서버 판정) */
  initialStep: PostActivityStep;
};

async function postActivity(body: Record<string, unknown>): Promise<Response> {
  const res = await fetch('/api/post-activity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? `저장하지 못했어요 (HTTP ${res.status})`);
  }
  return res;
}

export function PostActivityFlow({
  sessionId,
  storyId,
  storyTitle,
  cards,
  keywords,
  initialStep,
}: PostActivityFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<PostActivityStep>(initialStep);

  const exitToDetail = useCallback(() => {
    router.push(`/stories/${storyId}`); // 저장 없이 화면만 종료 — 진행 값은 서버에 이미 반영된 만큼 유지
  }, [router, storyId]);

  const submitCardOrder = useCallback(
    async (submittedOrder: string[]) => {
      const res = await postActivity({ sessionId, kind: 'card-order', submittedOrder });
      const { isOrderCorrect } = (await res.json()) as { isOrderCorrect: boolean; attemptCount: number };
      return { isOrderCorrect };
    },
    [sessionId],
  );

  const submitRetelling = useCallback(
    async (retellingText: string) => {
      await postActivity({ sessionId, kind: 'retelling', retellingText });
      router.push(`/complete/${sessionId}`); // completed_at 저장 완료 — 2.5 학습 완료 화면으로
    },
    [router, sessionId],
  );

  return (
    // h-dvh 고정 — 아이 화면 스크롤 미허용 (T071). 뷰포트가 극단적으로 짧을 때만 하위 섹션이 내부 스크롤로 수용
    <main className="flex h-dvh flex-col overflow-hidden">
      <ProgressHeader
        title={storyTitle}
        n={step === 'card-order' ? 1 : 2}
        N={2}
        onExit={exitToDetail}
      />
      {step === 'card-order' ? (
        <CardOrdering cards={cards} onSubmit={submitCardOrder} onProceed={() => setStep('retelling')} />
      ) : (
        <Retelling cards={cards} keywords={keywords} onSubmit={submitRetelling} />
      )}
    </main>
  );
}
