// 미션 노출 판정 순수 함수 (T040) — 기획 「방귀 뀌는 며느리 — 미션 노출 기준」 + 기능명세서 2.4.3 ⑥.
// LLM 무관·문장 미생성: 분석 확정본(요소·validity)과 턴 카운터만으로 판정한다 (규칙 엔진과 동일 원칙).
// 문서 조건 → 형식화 매핑:
//   미션1 ① 해결 방법 제안(방귀 활용 포함)      → 이번 턴 SOLUTION 탐지
//        ② 방향만 있고 구체적이지 않음          → 이번 턴 REASON·DECISION 탐지 + SOLUTION 미누적
//        ③ 2회 이상 대화했지만 실행 방법 없음    → turnCount ≥ 2 + SOLUTION 미누적
//        ④ 질문만으로 구체화 어려움             → 연속 저정보 턴 ≥ 2 (엔진 카운터 재사용)
//   미션2 자기 특징을 긍정하는 이유 발화 후       → VALID 발화에서 REASON·EMOTION·PERSPECTIVE 탐지
//        (미션 필수 장면 보장 폴백)             → turnCount ≥ 2
// 노출은 장면당 1회 '완료' — missionPhase(story_sessions.mission_phase, 002 마이그레이션)가 'completed'면 재노출 금지.
// 'exposed'(노출됐지만 미완료)는 재노출한다(T074, E2E 항목 21): 팝업은 클라이언트 휘발 상태라 새로고침·재진입·
// 응답 유실 시 사라지는데, DB가 'exposed'를 기억한 채 재노출을 막으면 미션 없이 MAX_TURNS 종료로 빠진다.
// CLOSING 조건 ③(미션+핵심 발화)은 미션 응답이 동일 분석·누적 경로를 타므로 GOAL_MET으로 자연 수렴 — 엔진 무변경.
import type { AnalysisResult, ThinkingElement } from '@/lib/contracts';
import type { Mission } from '@/lib/missions';

export type MissionPhase = 'exposed' | 'completed' | null;

export type MissionExposeReason =
  | 'SOLUTION_PROPOSED' // 미션1 ①
  | 'DIRECTION_ONLY' // 미션1 ②
  | 'NO_METHOD_AFTER_TURNS' // 미션1 ③ · 미션2 폴백
  | 'HARD_TO_CONCRETIZE' // 미션1 ④
  | 'SELF_AFFIRMATION_STATED' // 미션2
  | 'REEXPOSED'; // 노출 후 미완료 — 팝업 유실 복구 (T074)

export type MissionExposureInput = {
  /** 장면의 미션 (missions.ts missionForScene — 미션 없는 장면은 null) */
  mission: Mission | null;
  /** 세션의 현재 장면 미션 상태 — null이 아닐 때는 재노출 금지 (장면당 1회) */
  missionPhase: MissionPhase;
  /** 이번 발화 반영 후 아이 턴 수 (규칙 엔진 nextState.turnCount 기준) */
  turnCount: number;
  /** 이번 발화 탐지 요소 (서버 후처리 확정본) */
  detectedElements: ThinkingElement[];
  /** 이번 발화 반영 후 누적 요소 */
  accumulated: ThinkingElement[];
  utteranceValidity: AnalysisResult['utteranceValidity'];
  /** 이번 발화 반영 후 연속 저정보 턴 수 (규칙 엔진 카운터) */
  consecutiveLowInformationTurns: number;
};

export type MissionExposureDecision = { expose: boolean; reason: MissionExposeReason | null };

const NO_EXPOSURE: MissionExposureDecision = { expose: false, reason: null };

/** 미션2 노출 근거 요소 — 자기 특징 긍정(감정·이유·관점) 발화 */
const SELF_AFFIRMATION_ELEMENTS: ThinkingElement[] = ['REASON', 'EMOTION', 'PERSPECTIVE'];

export function evaluateMissionExposure(input: MissionExposureInput): MissionExposureDecision {
  const { mission, missionPhase, turnCount, detectedElements, accumulated, utteranceValidity } = input;
  if (!mission || missionPhase === 'completed') return NO_EXPOSURE;
  // 'exposed' 미완료 — 클라이언트 팝업이 유실된 상태일 수 있으므로 조건 재판정 없이 즉시 재노출 (T074)
  if (missionPhase === 'exposed') return { expose: true, reason: 'REEXPOSED' };

  if (mission.id === 'mission_1') {
    if (detectedElements.includes('SOLUTION')) {
      return { expose: true, reason: 'SOLUTION_PROPOSED' };
    }
    const hasDirection = detectedElements.some((e) => e === 'REASON' || e === 'DECISION');
    if (hasDirection && !accumulated.includes('SOLUTION')) {
      return { expose: true, reason: 'DIRECTION_ONLY' };
    }
    if (turnCount >= 2 && !accumulated.includes('SOLUTION')) {
      return { expose: true, reason: 'NO_METHOD_AFTER_TURNS' };
    }
    if (input.consecutiveLowInformationTurns >= 2) {
      return { expose: true, reason: 'HARD_TO_CONCRETIZE' };
    }
    return NO_EXPOSURE;
  }

  // mission_2 — 처음부터 보여주면 정해진 답을 찾으려 하므로, 자기 생각 발화가 확인된 뒤에만
  if (utteranceValidity === 'VALID' && detectedElements.some((e) => SELF_AFFIRMATION_ELEMENTS.includes(e))) {
    return { expose: true, reason: 'SELF_AFFIRMATION_STATED' };
  }
  if (turnCount >= 2) {
    return { expose: true, reason: 'NO_METHOD_AFTER_TURNS' };
  }
  return NO_EXPOSURE;
}
