// 규칙 엔진 순수 함수 (T023, FR-010) — 판단=코드, LLM=분석·생성만.
// 문장을 만들지 않는다. 입력은 세션 상태·장면 데이터·확정 분석 결과뿐이며 (계약 불변 조건 3),
// 시맨틱은 fixtures common_rules를 따른다: 누적 유지, 부족 요소만 유도, 종료 조건(GOAL_MET/MAX_TURNS).
import type { AnalysisResult, ProgressDecision, ThinkingElement } from '../contracts';

/** story_sessions에 저장되는 규칙 상태의 코드 표현 (camelCase — 저장 경계에서 snake_case 변환) */
export type RuleState = {
  /** 이번 턴 반영 전 아이 턴 수 (current_child_turn_count) */
  turnCount: number;
  accumulated: ThinkingElement[];
  turnsWithoutNewElement: number;
  consecutiveLowInformationTurns: number;
};

/** 장면에서 규칙 판정에 쓰는 데이터 (story_scenes) */
export type SceneRuleData = {
  requiredElements: ThinkingElement[];
  maxTurns: number;
};

/** GUIDED 전환 임계 — env 튜닝은 config.ts의 rules 참조 (게이트 임계와 같은 주입 패턴) */
export type RuleThresholds = {
  /** 새 요소 없는 턴이 이 횟수 이상 누적되면 GUIDED */
  guidedStagnantTurns: number;
  /** 저정보 발화(utteranceValidity !== 'VALID')가 이 횟수 이상 연속되면 GUIDED */
  guidedLowInfoTurns: number;
};

export const defaultThresholds: RuleThresholds = {
  guidedStagnantTurns: 1,
  guidedLowInfoTurns: 1,
};

export type TurnEvaluation = {
  decision: ProgressDecision;
  /** 저장용 다음 상태 (턴 카운트 +1 반영) */
  nextState: RuleState;
  /** 이번 턴에 처음 등장한 요소 (로그·디버깅용) */
  newElements: ThinkingElement[];
};

export function initialRuleState(): RuleState {
  return {
    turnCount: 0,
    accumulated: [],
    turnsWithoutNewElement: 0,
    consecutiveLowInformationTurns: 0,
  };
}

/**
 * 게이트를 통과한 아이 발화 1턴을 반영해 다음 상태와 진행 판정을 돌려준다.
 * 게이트 실패 발화는 이 함수에 오면 안 된다 (메시지 미생성·턴 카운트 제외 — 계약 불변 조건 1).
 */
export function evaluateTurn(
  state: RuleState,
  scene: SceneRuleData,
  analysis: AnalysisResult,
  thresholds: RuleThresholds = defaultThresholds,
): TurnEvaluation {
  const detected = analysis.detectedElements.map((element) => element.type);
  const newElements = [...new Set(detected)].filter(
    (type) => !state.accumulated.includes(type),
  );
  const accumulated = [...state.accumulated, ...newElements];
  // missing은 장면 required 순서를 보존한다 — guidanceTarget 선정 기준
  const missingElements = scene.requiredElements.filter(
    (type) => !accumulated.includes(type),
  );

  const turnCount = state.turnCount + 1;
  const turnsWithoutNewElement = newElements.length > 0 ? 0 : state.turnsWithoutNewElement + 1;
  const consecutiveLowInformationTurns =
    analysis.utteranceValidity === 'VALID' ? 0 : state.consecutiveLowInformationTurns + 1;

  const nextState: RuleState = {
    turnCount,
    accumulated,
    turnsWithoutNewElement,
    consecutiveLowInformationTurns,
  };

  // 종료 판정 — GOAL_MET이 MAX_TURNS보다 우선 (마지막 턴에 충족해도 목표 달성으로 기록)
  if (missingElements.length === 0) {
    return {
      decision: { mode: 'CLOSING', missingElements, sceneEndReason: 'GOAL_MET' },
      nextState,
      newElements,
    };
  }
  if (turnCount >= scene.maxTurns) {
    return {
      decision: { mode: 'CLOSING', missingElements, sceneEndReason: 'MAX_TURNS' },
      nextState,
      newElements,
    };
  }

  const shouldGuide =
    turnsWithoutNewElement >= thresholds.guidedStagnantTurns ||
    consecutiveLowInformationTurns >= thresholds.guidedLowInfoTurns;

  if (shouldGuide) {
    return {
      decision: {
        mode: 'GUIDED',
        missingElements,
        guidanceTarget: missingElements[0], // 장면 required 순서상 첫 부족 요소 1개 (계약 타입 단수)
      },
      nextState,
      newElements,
    };
  }

  return {
    decision: { mode: 'NORMAL', missingElements },
    nextState,
    newElements,
  };
}
