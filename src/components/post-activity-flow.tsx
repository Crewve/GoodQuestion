'use client';
// 학습완료 활동 흐름 (T055) — 2.4.4 카드 배열(T053) → 2.4.5 재구성 발화(T054) 전환과
// /api/post-activity(T052) 호출을 소유한다. 화면 컴포넌트의 접점은 콜백뿐(판정·저장은 서버).
// 헤더는 피그마 「개발 배포용」 2.4.4·2.4.5 공통 헤더(나가기 필 + n/N 진행 배지)를 인라인 구현 —
// 진행 헤더(T035, progress-header.tsx)는 2.4.1~2.4.3 계열 공용이라 이 파일에서 직접 마크업한다.
// X 나가기: 저장 없이 종료 → 2.3 이야기 상세(2.4.4 화면 이동 — 재진입 라우팅은 서버 저장값 기준).
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { withChild } from '@/components/bottom-nav';
import { CardOrdering, type PostActivityCard } from '@/components/card-ordering';
import { CloseIcon } from '@/components/icons';
import { Retelling } from '@/components/retelling';

export type PostActivityStep = 'card-order' | 'retelling';

type PostActivityFlowProps = {
  sessionId: string;
  storyId: string;
  /** 세션의 아이 — 나가기 링크에 ?child=로 실어 보낸다 (없으면 홈 복귀 시 아이 선택으로 튕김, QA 17) */
  childId: string | null;
  storyTitle: string;
  /** 정답 순서로 정렬된 카드 N장(config.cards) — 무작위 제시는 CardOrdering 내부 몫 */
  cards: PostActivityCard[];
  /** keywords[i] = cards[i] 장면의 핵심 단어 묶음 (2.4.5 카드 아래 칩들) */
  keywords: string[][];
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
  childId,
  storyTitle,
  cards,
  keywords,
  initialStep,
}: PostActivityFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<PostActivityStep>(initialStep);
  const n = step === 'card-order' ? 1 : 2;

  const exitToDetail = useCallback(() => {
    // 저장 없이 화면만 종료 — 진행 값은 서버에 이미 반영된 만큼 유지.
    // 아이 컨텍스트 유지는 진행 화면 나가기와 동일 규칙 (QA 17)
    router.push(withChild(`/stories/${storyId}`, childId));
  }, [childId, router, storyId]);

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
    // h-dvh 고정 — 아이 화면 스크롤 미허용 (T071). 행들이 flex 비율로 줄어들어 한 화면에 수납된다.
    <main className="flex h-dvh flex-col overflow-hidden bg-background">
      <h1 className="sr-only">{storyTitle} — 학습완료 활동</h1>
      {/* 2.4.4/2.4.5 공통 헤더 — 나가기 필 + 진행 배지 (피그마 header 1194×101) */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#F0E4D3] px-6 py-4">
        <button
          type="button"
          onClick={exitToDetail}
          className="flex h-14 items-center gap-2.5 rounded-full bg-white px-5 shadow-[0_3px_10px_rgba(0,0,0,0.25)] active:bg-ink active:text-white"
        >
          <CloseIcon className="size-6 text-current" />
          <span className="font-display text-2xl text-current">나가기</span>
        </button>
        <span
          // 피그마 원색 primary 채택(2026-08-14 "피그마와 동일하게" 지시) — 페치 배경 대비 2.4:1 미달 인지
          className="rounded-full bg-[#FFE8C9] px-3.5 py-1.5 font-display text-[22px] leading-none text-primary"
          aria-label={`학습완료 활동 진행 ${n}단계 / 전체 2단계`}
        >
          {n} / 2
        </span>
      </header>
      {step === 'card-order' ? (
        <CardOrdering cards={cards} onSubmit={submitCardOrder} onProceed={() => setStep('retelling')} />
      ) : (
        <Retelling cards={cards} keywords={keywords} onSubmit={submitRetelling} />
      )}
    </main>
  );
}
