'use client';
// 카드 순서 배열 화면 (T053, 기능명세서 2.4.4 "장면 카드 맞추기") — 무작위 N장을 슬롯 1~N에 배치.
// 카드 수는 post_activity_config.cards 길이를 그대로 따른다(2026-08-15 수정사항 C3 / QA 12 "카드 몇가지 더 추가"로
// 4장 고정 → 가변). 트레이·슬롯 열 수도 같이 늘어나므로 Tailwind 정적 클래스 대신 gridTemplateColumns로 지정한다.
// 드래그앤드롭 기본 + Tap-to-Move 보조(FR-020, 핸드오프 §6.1 — 저학년 드래그 미숙 대비 병행 제공).
// 드래그는 Pointer Events 직접 구현(2026-08-13) — HTML5 DnD API는 터치(태블릿 1순위 타깃)에서
// 동작하지 않아 교체. 이동 8px 전에는 탭으로 취급해 Tap-to-Move와 충돌하지 않는다.
// 4개 슬롯이 모두 채워지면 자동 제출 — 판정은 서버(/api/post-activity, 프런트 판정 금지 FR-016)이며
// 이 컴포넌트의 접점은 onSubmit(제출)·onProceed("정답이에요!" 클릭) 콜백뿐, 호출·저장은 컨테이너(파트2 T055) 소유.
// 오답 시 카드는 슬롯에 놓인 상태 그대로 유지·재드래그 후 재제출(제출마다 attempt_count+1는 서버 몫).
//   ⚠️ 명세 내부 상충: 2.4.4 예외 처리·구성요소는 "배치 유지(자동 원위치 복귀 없음)", 화면 이동 칸은
//   "원위치 복귀 후 재시도" — 구성요소·예외 처리·T053 태스크 확정대로 '유지'로 구현(tasks.md에 기록, 팀 공유).
// 슬롯 외 영역 드롭은 원위치 복귀(미제출·attempt_count 미증가). X 나가기·재진입 라우팅은 컨테이너 책임.
// 카드 콘텐츠는 T051 post_activity_config가 SoT라 props로 받는다(fixtures 직접 로드 없음).
// 스타일: 피그마 「개발 배포용」 2.4.4 Case A/B — 이미지 전면 카드·흰 슬롯(#F0E4D3 테두리)·하단 판정 필.
// 판정 표시는 색+아이콘+텍스트 병행. 필 텍스트는 시안 원색 흰색 채택(2026-08-14 "피그마와 동일하게" 지시,
// sage/primary 배경 대비 하한 미달 인지).
import { useCallback, useRef, useState } from 'react';
import { CheckIcon, CloseIcon } from '@/components/icons';

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
  /** 장면 카드 N장(config.cards 그대로) — 제시 순서는 컴포넌트가 무작위화 */
  cards: PostActivityCard[];
  /**
   * 모든 칸 채움 시 자동 호출 — 서버 판정(/api/post-activity kind:'card-order', T052)은 컨테이너 책임.
   * 제출마다 서버가 attempt_count를 누적한다(시도별 배열 내용은 저장하지 않음 — 2.4.4).
   */
  onSubmit: (submittedOrder: string[]) => Promise<{ isOrderCorrect: boolean }>;
  /** "정답이에요!" 버튼 클릭 — 컨테이너가 2.4.5(재구성 발화)로 전환 */
  onProceed: () => void;
};

export function CardOrdering({ cards, onSubmit, onProceed }: CardOrderingProps) {
  const [trayIds, setTrayIds] = useState<string[]>(() => shuffle(cards.map((card) => card.id)));
  const [slots, setSlots] = useState<(string | null)[]>(() => cards.map(() => null));
  // 카드 수만큼 열을 나눈다 — grid-cols-N은 Tailwind가 정적 스캔이라 런타임 값으로 못 만든다
  const columns = { gridTemplateColumns: `repeat(${Math.max(cards.length, 1)}, minmax(0, 1fr))` };
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
      // 슬롯이 모두 채워지면 서버로 제출 (2.4.4 유효성 — 채움이 곧 제출 트리거)
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

  // --- Pointer 드래그 (터치·마우스 공용) ---

  /** 드래그 중 고스트 표시 상태 — 렌더용. 판정은 refs 기준 */
  const [drag, setDrag] = useState<{ cardId: string; x: number; y: number; w: number; h: number } | null>(null);
  const dragRef = useRef<{ cardId: string; startX: number; startY: number; w: number; h: number; started: boolean } | null>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  /** 드래그로 끝난 pointerup 뒤에 따라오는 click 1회 무시 — Tap-to-Move 오발동 방지 */
  const suppressClickRef = useRef(false);
  const DRAG_THRESHOLD_PX = 8;

  const handlePointerDown = (event: React.PointerEvent, cardId: string) => {
    if (locked) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { cardId, startX: event.clientX, startY: event.clientY, w: rect.width, h: rect.height, started: false };
  };

  const handlePointerMove = (event: React.PointerEvent, cardId: string) => {
    const state = dragRef.current;
    if (!state || state.cardId !== cardId) return;
    if (!state.started) {
      const moved = Math.hypot(event.clientX - state.startX, event.clientY - state.startY);
      if (moved < DRAG_THRESHOLD_PX) return; // 미세 이동은 탭으로 취급
      state.started = true;
      suppressClickRef.current = true;
      setSelectedId(null); // 드래그 시작 — 탭 선택 상태와 겹치지 않게
    }
    setDrag({ cardId, x: event.clientX, y: event.clientY, w: state.w, h: state.h });
  };

  const handlePointerEnd = (event: React.PointerEvent, cardId: string) => {
    const state = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!state || state.cardId !== cardId || !state.started) return; // 드래그 미시작 = 탭 — click 핸들러가 처리
    // 드롭 판정 — 포인터 좌표가 들어간 슬롯에 배치, 슬롯 밖은 원위치/트레이 복귀 (미제출)
    const { clientX: x, clientY: y } = event;
    const slotIndex = slotRefs.current.findIndex((el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    });
    if (slotIndex >= 0) placeCard(cardId, slotIndex);
    else returnCard(cardId);
  };

  /** 장면 카드 — 이미지 전면(라벨은 aria로 유지, 피그마 카드 컴포넌트는 이미지 온리) */
  const renderCard = (cardId: string) => {
    const card = cardById.get(cardId);
    if (!card) return null;
    const selected = selectedId === cardId;
    const dragging = drag?.cardId === cardId;
    return (
      <button
        type="button"
        onPointerDown={(event) => handlePointerDown(event, cardId)}
        onPointerMove={(event) => handlePointerMove(event, cardId)}
        onPointerUp={(event) => handlePointerEnd(event, cardId)}
        onPointerCancel={(event) => handlePointerEnd(event, cardId)}
        onClick={(event) => {
          event.stopPropagation(); // 트레이/슬롯 컨테이너 탭 핸들러와 분리 — 이중 동작 방지
          if (suppressClickRef.current) {
            suppressClickRef.current = false; // 직전 드래그의 잔여 click — 탭으로 처리하지 않는다
            return;
          }
          handleCardTap(cardId);
        }}
        aria-pressed={selected}
        aria-label={`${card.label} 카드${selected ? ' 선택됨' : ''}`}
        className={`mx-auto aspect-[275/218] w-full max-h-full min-h-0 touch-none self-center overflow-hidden rounded-2xl border-[1.5px] bg-white shadow-[0_6px_18px_rgba(58,44,30,0.08)] transition-transform ${
          selected ? 'scale-105 border-primary ring-4 ring-primary' : 'border-[#F0E4D3]'
        } ${dragging ? 'opacity-40' : ''} ${locked ? '' : 'cursor-grab active:cursor-grabbing'}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Storage 외부 URL (기존 화면과 동일 패턴) */}
        <img src={card.imageUrl} alt="" draggable={false} className="h-full w-full object-cover" />
      </button>
    );
  };

  const dragCard = drag ? cardById.get(drag.cardId) : null;

  return (
    // 피그마 workspace 실측(2026-08-14): pad 상40·하24·좌우40, 행 간격 30 — 행들은 flex로 줄어들며 무스크롤 유지
    <section className="flex min-h-0 flex-1 flex-col gap-[30px] px-10 pb-6 pt-10">
      {/* 드래그 고스트 — 포인터를 따라다니는 카드 사본. pointer-events 차단으로 드롭 판정에 간섭하지 않는다 */}
      {drag && dragCard && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-50 overflow-hidden rounded-2xl border-[1.5px] border-primary bg-white shadow-[0_10px_28px_rgba(58,44,30,0.25)]"
          style={{ left: drag.x - drag.w / 2, top: drag.y - drag.h / 2, width: drag.w, height: drag.h }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Storage 외부 URL (기존 화면과 동일 패턴) */}
          <img src={dragCard.imageUrl} alt="" draggable={false} className="h-full w-full object-cover" />
        </div>
      )}
      {/* 활동 안내 (T067 문구 유지) + 보조 안내 — 실측(2026-08-14): 보조 22 #8A7A68 · 간격 8 */}
      <div className="shrink-0">
        <p className="font-display text-[32px] leading-snug text-ink">이야기 순서에 맞게 카드를 놓아보세요!</p>
        <p className="mt-2 font-display text-[22px] text-[#8A7A68]">아래 카드들을 알맞은 빈칸에 올려놓으세요.</p>
      </div>

      {/* 카드 트레이 — 무작위 제시, 슬롯 외 영역 드롭 = 원위치/트레이 복귀 (미제출) */}
      <div
        onClick={() => selectedId && slots.includes(selectedId) && returnCard(selectedId)}
        style={columns}
        className="grid min-h-0 flex-1 gap-4"
        aria-label="카드 보관함"
      >
        {trayIds.map((cardId) => (
          <div key={cardId} className="flex min-h-0 justify-center">
            {renderCard(cardId)}
          </div>
        ))}
      </div>

      {/* 순서 슬롯 1~N — 드롭·탭 배치, 점유 슬롯은 자리 교환 (피그마 card_slot: 흰 배경 #F0E4D3 2px) */}
      <div style={columns} className="grid min-h-0 flex-1 gap-4">
        {slots.map((cardId, index) => (
          <div
            key={index}
            ref={(el) => {
              slotRefs.current[index] = el;
            }}
            onClick={() => handleSlotTap(index)}
            role="button"
            aria-label={`${index + 1}번 슬롯${cardId ? ` — ${cardById.get(cardId)?.label ?? ''}` : ' (비어 있음)'}`}
            className={`mx-auto flex aspect-[275/218] w-full max-h-full min-h-0 self-center flex-col rounded-2xl border-2 bg-white p-4 ${
              selectedId && !locked ? 'border-primary/60' : 'border-[#F0E4D3]'
            }`}
          >
            {cardId ? (
              renderCard(cardId)
            ) : (
              // 슬롯 플레이스홀더 — card_slot 심볼 실측: 숫자 32 · 안내 16 · #8A7A68
              <span className="flex h-full flex-col items-center justify-center gap-1 text-[#8A7A68]">
                <span className="font-display text-[32px] leading-none" aria-hidden>
                  {index + 1}
                </span>
                <span className="font-display text-base" aria-hidden>
                  여기에 놓으세요
                </span>
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 판정 결과 — 하단 중앙 필, 색+아이콘+텍스트 병행 (FR-020).
          실측(2026-08-14): h52·글자 22 흰색(시안 원색 — 대비 미달 인지 채택)·pad 40 */}
      <div className="flex min-h-[52px] shrink-0 items-center justify-center gap-3">
        {submitting && (
          <span className="animate-pulse text-2xl text-ink" role="status" aria-label="순서를 확인하는 중">
            ● ● ●
          </span>
        )}
        {verdict === 'correct' && (
          <button
            type="button"
            onClick={onProceed}
            className="flex h-[52px] items-center gap-3 rounded-full bg-sage px-10 font-display text-[22px] text-white shadow-[0_6px_20px_rgba(61,190,139,0.33)] active:bg-ink"
          >
            <CheckIcon className="w-6" /> {MESSAGE_CORRECT}
          </button>
        )}
        {verdict === 'wrong' && (
          // 표시 전용 버튼(클릭 동작 없음 — 2.4.4 구성요소) — 카드 재드래그로만 복구
          <span
            role="status"
            className="flex h-[52px] items-center gap-3 rounded-full bg-primary px-10 font-display text-[22px] text-white shadow-[0_6px_20px_rgba(255,122,61,0.33)]"
          >
            <CloseIcon className="size-6" /> {MESSAGE_WRONG}
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
