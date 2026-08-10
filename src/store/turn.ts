// 턴 상태머신 (T033, data-model §5) — Zustand.
// CHAR_SPEAKING → RECORDING → TRANSCRIBING → REVIEW → SUBMITTED → CHAR_SPEAKING 순환.
// 게이트 실패는 TRANSCRIBING → RECORDING 복귀(메시지 미생성). 잘못된 단계의 전이는 무시한다.
// 상태 배지 문구는 data-model §5 고정 3종 — 화면(T037)이 phase→라벨 매핑에 사용.
import { create } from 'zustand';
import type { SttResult } from '@/lib/contracts';

export type TurnPhase = 'CHAR_SPEAKING' | 'RECORDING' | 'TRANSCRIBING' | 'REVIEW' | 'SUBMITTED';

/** 상태 배지 라벨 (기능명세서 2.4.3 — SUBMITTED는 라벨 없는 처리 구간) */
export const PHASE_LABELS: Record<TurnPhase, string | null> = {
  CHAR_SPEAKING: '캐릭터의 말을 듣고 있어요!',
  RECORDING: '생각을 말해보세요!',
  TRANSCRIBING: '말을 글자로 바꾸는 중이에요!',
  REVIEW: null,
  SUBMITTED: null,
};

type TurnStore = {
  phase: TurnPhase;
  /** REVIEW에서 표시할 확정 텍스트 (수정 불가) */
  sttText: string | null;
  sttRawText: string | null;
  /** 캐릭터 대사 재생 종료 → 마이크 자동 시작 (FR-007) */
  characterAudioEnded: () => void;
  /** 아이가 마이크 버튼으로 녹음 종료 → 변환 중 */
  stopRecording: () => void;
  /** STT 응답 수신 — failed=true면 RECORDING 복귀(재시도 안내), 아니면 REVIEW */
  sttSucceeded: (result: SttResult) => void;
  /** STT 호출 자체가 실패(네트워크 등) — RECORDING 복귀 */
  sttFailed: () => void;
  /** 보내기 클릭 — 이때만 /api/turn 호출 */
  submit: () => void;
  /** 캐릭터 응답 재생 시작 — 다음 턴 사이클 진입 */
  characterSpeaking: () => void;
  reset: () => void;
};

const initial = { phase: 'CHAR_SPEAKING' as TurnPhase, sttText: null, sttRawText: null };

export const useTurnStore = create<TurnStore>((set) => ({
  ...initial,
  characterAudioEnded: () =>
    set((state) => (state.phase === 'CHAR_SPEAKING' ? { phase: 'RECORDING' } : state)),
  stopRecording: () =>
    set((state) => (state.phase === 'RECORDING' ? { phase: 'TRANSCRIBING' } : state)),
  sttSucceeded: (result) =>
    set((state) => {
      if (state.phase !== 'TRANSCRIBING') return state;
      if (result.failed) {
        // 게이트 실패 — 메시지 미생성, 재녹음 유도 (계약 불변 조건 1)
        return { phase: 'RECORDING', sttText: null, sttRawText: null };
      }
      return { phase: 'REVIEW', sttText: result.text, sttRawText: result.sttRawText };
    }),
  sttFailed: () =>
    set((state) =>
      state.phase === 'TRANSCRIBING' ? { phase: 'RECORDING', sttText: null, sttRawText: null } : state,
    ),
  submit: () => set((state) => (state.phase === 'REVIEW' ? { phase: 'SUBMITTED' } : state)),
  characterSpeaking: () =>
    set((state) =>
      state.phase === 'SUBMITTED' ? { phase: 'CHAR_SPEAKING', sttText: null, sttRawText: null } : state,
    ),
  reset: () => set(initial),
}));
