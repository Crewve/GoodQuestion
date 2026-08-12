'use client';
// 카드 순서 배열 화면 (T053, 기능명세서 2.4.4 "장면 카드 맞추기") — 무작위 4장을 슬롯 1~4에 배치.
// 드래그앤드롭 기본 + Tap-to-Move 보조(FR-020, 핸드오프 §6.1 — 저학년 드래그 미숙 대비 병행 제공).
// 4개 슬롯이 모두 채워지면 자동 제출 — 판정은 서버(/api/post-activity, 프런트 판정 금지 FR-016)이며
// 이 컴포넌트의 접점은 onSubmit(제출)·onProceed("정답이에요!" 클릭) 콜백뿐, 호출·저장은 컨테이너(파트2 T055) 소유.
// 오답 시 카드는 슬롯에 놓인 상태 그대로 유지·재드래그 후 재제출(제출마다 attempt_count+1는 서버 몫).
//   ⚠️ 명세 내부 상충: 2.4.4 예외 처리·구성요소는 "배치 유지(자동 원위치 복귀 없음)", 화면 이동 칸은
//   "원위치 복귀 후 재시도" — 구성요소·예외 처리·T053 태스크 확정대로 '유지'로 구현(tasks.md에 기록, 팀 공유).
// 슬롯 외 영역 드롭은 원위치 복귀(미제출·attempt_count 미증가). X 나가기·재진입 라우팅은 컨테이너 책임.
// 카드 콘텐츠는 T051 post_activity_config가 SoT라 props로 받는다(fixtures 직접 로드 없음).
// 스타일: 피그마 「개발 배포용」 2.4.4 Case A/B — 이미지 전면 카드·흰 슬롯(#F0E4D3 테두리)·하단 판정 필.
// 판정 표시는 색+아이콘+텍스트 병행(기존 구현 유지). 필 텍스트는 대비 하한(4.5:1) 우선으로 ink 사용.
import { useCallback, useRef, useState } from 'react';

/** post_activity_config.cards 항목 (R-09 스키마) — 이미지 URL은 컨테이너가 T011 헬퍼로 조합해 내려준다 */
export type PostActivityCard = { id: string; imageUrl: string; label: string };

const MESSAGE_CORRECT = '정답이에요!';
const MESSAGE_WRONG = '순서가 달라요, 다시 놓아볼까요?';
const MESSAGE_SUBMIT_ERROR = '결과를 확인하지 못했어요. 다시 보내볼까요?';

/** Fisher–Yates — 무작위 제시(2.4.4)는 마운트 시 1회 고정 */
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export type CardOrderingProps = {
  /** 장면 카드 4장 — 제시 순서는 컴포넌트가 무작위화 */
  cards: PostActivityCard[];
  /**
   * 4칸 채움 시 자동 호출 — 서버 판정(/api/post-activity kind:'card-order', T052)은 컨테이너 책임.
   * 제출마다 서버가 attempt_count를 누적한다(시도별 배열 내용은 저장하지 않음 — 2.4.4).
   */
  onSubmit: (submittedOrder: string[]) => Promise<{ isOrderCorrect: boolean }>;
  /** "정답이에요!" 버튼 클릭 — 컨테이너가 2.4.5(재구성 발화)로 전환 */
  onProceed: () => void;
};

export function CardOrdering({ cards, onSubmit, onProceed }: CardOrderingProps) {
  const [trayIds, setTrayIds] = useState<string[]>(() => shuffle(cards.map((card) => card.id)));
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null]);
  const [selectedId, setSelectedId] = useState<string | null>(null); // Tap-to-Move 선택 상태
  const [verdict, setVerdict] = useState<'correct' | 'wrong' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  // 최신 배치의 제출만 화면에 반영 — 연속 재배치로 겹친 이전 응답은 무시
  const submitSeqRef = useRef(0);

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const locked = submitting || verdict === 'correct'; // 판정 대기·정답 후에는 재배치 잠금

  const submitOrder = useCallback(
    async (order: string[]) => {
      const seq = (submitSeqRef.current += 1);
      setSubmitting(true);
      setSubmitError(false);
      setVerdict(null);
      try {
        const { isOrderCorrect } = await onSubmit(order);
        if (seq !== submitSeqRef.current) return;
        setVerdict(isOrderCorrect ? 'correct' : 'wrong');
      } catch {
        if (seq !== submitSeqRef.current) return;
        setSubmitError(true); // 판정 실패 — 배치 유지, 수동 재제출 (명세 미정의 장애 케이스, 다른 화면과 동일 규칙)
      } finally {
        if (seq === submitSeqRef.current) setSubmitting(false);
      }
    },
    [onSubmit],
  );

  /** 배치 이동의 단일 진입점 — 드래그 드롭·탭 배치 공용. 대상 슬롯 점유 시 자리 교환 */
  const placeCard = useCallback(
    (cardId: string, slotIndex: number) => {
      if (locked) return;
      setSelectedId(null);
      setVerdict(null); // 재배치 시작 — 이전 판정 배지 제거, 새 제출 결과로 대체
      const nextSlots = [...slots];
      const occupant = nextSlots[slotIndex];
      if (occupant === cardId) return;
      const fromSlot = nextSlots.indexOf(cardId);
      let nextTray = trayIds.filter((id) => id !== cardId);
      if (fromSlot >= 0) nextSlots[fromSlot] = null;
      if (occupant) {
        // 점유 카드는 이동 카드의 원래 자리로 — 슬롯 출신이면 교환, 트레이 출신이면 트레이로
        if (fromSlot >= 0) nextSlots[fromSlot] = occupant;
        else nextTray = [...nextTray, occupant];
      }
      nextSlots[slotIndex] = cardId;
      setSlots(nextSlots);
      setTrayIds(nextTray);
      // 4개 슬롯이 모두 채워지면 서버로 제출 (2.4.4 유효성 — 채움이 곧 제출 트리거)
      if (nextSlots.every((id) => id !== null)) void submitOrder(nextSlots as string[]);
    },
    [locked, slots, submitOrder, trayIds],
  );

  /** 슬롯 카드 → 트레이 복귀 (트레이 영역 드롭·탭) — 미제출 상태로 되돌리기 */
  const returnCard = useCallback(
    (cardId: string) => {
      if (locked) return;
      setSelectedId(null);
      const fromSlot = slots.indexOf(cardId);
      if (fromSlot < 0) return;
      setVerdict(null);
      const nextSlots = [...slots];
      nextSlots[fromSlot] = null;
      setSlots(nextSlots);
      setTrayIds([...trayIds, cardId]);
    },
    [locked, slots, trayIds],
  );

  /** Tap-to-Move — 카드 탭: 선택/해제, 다른 카드 선택 중 슬롯 카드 탭: 그 자리로 배치(교환) */
  const handleCardTap = useCallback(
    (cardId: string) => {
      if (locked) return;
      if (selectedId && selectedId !== cardId) {
        const slotIndex = slots.indexOf(cardId);
        if (slotIndex >= 0) {
          placeCard(selectedId, slotIndex);
          return;
        }
      }
      setSelectedId((current) => (current === cardId ? null : cardId));
    },
    [locked, placeCard, selectedId, slots],
  );

  const handleSlotTap = useCallback(
    (slotIndex: number) => {
      if (locked) return;
      const occupant = slots[slotIndex];
      if (selectedId) {
        placeCard(selectedId, slotIndex);
      } else if (occupant) {
        setSelectedId(occupant); // 선택 없이 점유 슬롯 탭 — 그 카드를 선택
      }
    },
    [locked, placeCard, selectedId, slots],
  );

  const handleDragStart = (event: React.DragEvent, cardId: string) => {
    if (locked) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('text/plain', cardId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const droppedCardId = (event: React.DragEvent): string | null => {
    event.preventDefault();
    const id = event.dataTransfer.getData('text/plain');
    return id && cardById.has(id) ? id : null;
  };

  /** 장면 카드 — 이미지 전면(라벨은 aria로 유지, 피그마 카드 컴포넌트는 이미지 온리) */
  const renderCard = (cardId: string) => {
    const card = cardById.get(cardId);
    if (!card) return null;
    const selected = selectedId === cardId;
    return (
      <button
        type="button"
        draggable={!locked}
        onDragStart={(event) => handleDragStart(event, cardId)}
        onClick={(event) => {
          event.stopPropagation(); // 트레이/슬롯 컨테이너 탭 핸들러와 분리 — 이중 동작 방지
          handleCardTap(cardId);
        }}
        aria-pressed={selected}
        aria-label={`${card.label} 카드${selected ? ' 선택됨' : ''}`}
        className={`h-full min-h-0 w-full overflow-hidden rounded-2xl border-[1.5px] bg-white shadow-[0_6px_18px_rgba(58,44,30,0.08)] transition-transform ${
          selected ? 'scale-105 border-primary ring-4 ring-primary' : 'border-[#F0E4D3]'
        } ${locked ? '' : 'cursor-grab active:cursor-grabbing'}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Storage 외부 URL (기존 화면과 동일 패턴) */}
        <img src={card.imageUrl} alt="" draggable={false} className="h-full w-full object-cover" />
      </button>
    );
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-5 px-10 pb-6 pt-6">
      {/* 활동 안내 (T067 문구 유지) + 보조 안내 (피그마 instruction-banner) */}
      <div className="shrink-0">
        <p className="font-display text-[32px] leading-snug text-ink">이야기 순서에 맞게 카드를 놓아보세요!</p>
        <p className="mt-1 font-display text-[22px] text-[#6F6152]">아래 카드들을 알맞은 빈칸에 올려놓으세요.</p>
      </div>

      {/* 카드 트레이 — 무작위 제시, 슬롯 외 영역 드롭 = 원위치/트레이 복귀 (미제출) */}
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          const id = droppedCardId(event);
          if (id) returnCard(id);
        }}
        onClick={() => selectedId && slots.includes(selectedId) && returnCard(selectedId)}
        className="grid min-h-0 flex-1 grid-cols-4 gap-4"
        aria-label="카드 보관함"
      >
        {trayIds.map((cardId) => (
          <div key={cardId} className="min-h-0">
            {renderCard(cardId)}
          </div>
        ))}
      </div>

      {/* 순서 슬롯 1~4 — 드롭·탭 배치, 점유 슬롯은 자리 교환 (피그마 card_slot: 흰 배경 #F0E4D3 2px) */}
      <div className="grid min-h-0 flex-1 grid-cols-4 gap-4">
        {slots.map((cardId, index) => (
          <div
            key={index}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const id = droppedCardId(event);
              if (id) placeCard(id, index);
            }}
            onClick={() => handleSlotTap(index)}
            role="button"
            aria-label={`${index + 1}번 슬롯${cardId ? ` — ${cardById.get(cardId)?.label ?? ''}` : ' (비어 있음)'}`}
            className={`flex min-h-0 flex-col rounded-2xl border-2 bg-white p-2 ${
              selectedId && !locked ? 'border-primary/60' : 'border-[#F0E4D3]'
            }`}
          >
            {cardId ? (
              renderCard(cardId)
            ) : (
              <span className="flex h-full flex-col items-center justify-center gap-1 text-[#6F6152]">
                <span className="font-display text-[32px] leading-none" aria-hidden>
                  {index + 1}
                </span>
                <span className="font-display text-lg" aria-hidden>
                  여기에 놓으세요
                </span>
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 판정 결과 — 하단 중앙 필, 색+아이콘+텍스트 병행 (FR-020) */}
      <div className="flex min-h-14 shrink-0 items-center justify-center gap-3">
        {submitting && (
          <span className="animate-pulse text-2xl text-ink" role="status" aria-label="순서를 확인하는 중">
            ● ● ●
          </span>
        )}
        {verdict === 'correct' && (
          <button
            type="button"
            onClick={onProceed}
            className="flex h-14 items-center gap-3 rounded-full bg-sage px-10 font-display text-[22px] text-ink shadow-[0_6px_20px_rgba(61,190,139,0.33)] active:bg-ink active:text-white"
          >
            <span aria-hidden>✓</span> {MESSAGE_CORRECT}
          </button>
        )}
        {verdict === 'wrong' && (
          // 표시 전용 버튼(클릭 동작 없음 — 2.4.4 구성요소) — 카드 재드래그로만 복구
          <span
            role="status"
            className="flex h-14 items-center gap-3 rounded-full bg-primary px-10 font-display text-[22px] text-ink shadow-[0_6px_20px_rgba(255,122,61,0.33)]"
          >
            <span aria-hidden>✕</span> {MESSAGE_WRONG}
          </span>
        )}
        {submitError && (
          <>
            <span className="text-lg font-semibold text-[#B84A12]">{MESSAGE_SUBMIT_ERROR}</span>
            <button
              type="button"
              onClick={() => slots.every((id) => id !== null) && void submitOrder(slots as string[])}
              className="h-12 rounded-full bg-primary px-5 text-lg font-bold text-ink active:bg-ink active:text-white"
            >
              다시 보내기
            </button>
          </>
        )}
      </div>
    </section>
  );
}
