// T024 — 규칙 엔진 단위 테스트 (FR-010, fixtures common_rules 준거)
// 케이스: 누적 유지 · 모드 전환(NORMAL/GUIDED) · 최대 턴 · 조기 종료(GOAL_MET)
import { expect, test } from 'vitest';
import type { AnalysisResult, ThinkingElement } from '../contracts';
import { evaluateTurn, initialRuleState, type SceneRuleData } from './engine';

/** 대화1 장면 근사 — required 4종·최대 4턴 (fixtures sc_banggui_03) */
const scene: SceneRuleData = {
  requiredElements: ['PERSPECTIVE', 'EMOTION', 'REASON', 'SOLUTION'],
  maxTurns: 4,
};

function analysis(
  types: ThinkingElement[],
  validity: AnalysisResult['utteranceValidity'] = 'VALID',
): AnalysisResult {
  return {
    childIntent: '테스트 의도',
    mainPoint: '테스트 요지',
    detectedElements: types.map((type) => ({ type, evidence: '테스트 인용' })),
    utteranceValidity: validity,
  };
}

test('요소 누적이 여러 턴에 걸쳐 유지되고 missing은 줄어든다', () => {
  const turn1 = evaluateTurn(initialRuleState(), scene, analysis(['EMOTION']));
  expect(turn1.nextState.accumulated).toEqual(['EMOTION']);
  expect(turn1.decision.missingElements).toEqual(['PERSPECTIVE', 'REASON', 'SOLUTION']);

  const turn2 = evaluateTurn(turn1.nextState, scene, analysis(['REASON']));
  expect(turn2.nextState.accumulated).toEqual(expect.arrayContaining(['EMOTION', 'REASON']));
  expect(turn2.decision.missingElements).toEqual(['PERSPECTIVE', 'SOLUTION']);
});

test('required 밖 요소도 누적되지만 missing 계산에는 영향이 없다', () => {
  const result = evaluateTurn(initialRuleState(), scene, analysis(['REQUEST']));
  expect(result.nextState.accumulated).toEqual(['REQUEST']);
  expect(result.decision.missingElements).toEqual(scene.requiredElements);
});

test('새 요소가 있는 VALID 발화는 카운터를 리셋하고 NORMAL을 유지한다', () => {
  const stagnant = {
    ...initialRuleState(),
    accumulated: ['EMOTION'] as ThinkingElement[],
    turnsWithoutNewElement: 1,
    consecutiveLowInformationTurns: 1,
  };
  const result = evaluateTurn(stagnant, scene, analysis(['REASON']));
  expect(result.decision.mode).toBe('NORMAL');
  expect(result.nextState.turnsWithoutNewElement).toBe(0);
  expect(result.nextState.consecutiveLowInformationTurns).toBe(0);
});

test('새 요소 없는 턴이 이어지면 GUIDED로 전환하고 부족 요소를 유도 대상으로 지정한다', () => {
  const turn1 = evaluateTurn(initialRuleState(), scene, analysis(['EMOTION']));
  const turn2 = evaluateTurn(turn1.nextState, scene, analysis(['EMOTION'])); // 새 요소 없음
  expect(turn2.nextState.turnsWithoutNewElement).toBe(1);
  expect(turn2.decision.mode).toBe('GUIDED');
  // 유도 대상은 장면 required 순서상 첫 부족 요소
  expect(turn2.decision.guidanceTarget).toBe('PERSPECTIVE');
});

test('저정보 발화(SHORT 등)가 이어지면 GUIDED로 전환한다', () => {
  const result = evaluateTurn(initialRuleState(), scene, analysis([], 'SHORT'));
  expect(result.nextState.consecutiveLowInformationTurns).toBe(1);
  expect(result.decision.mode).toBe('GUIDED');
});

test('최대 턴 도달 시 CLOSING(MAX_TURNS) — 목표 미충족이어도 종료한다', () => {
  const lastTurn = {
    ...initialRuleState(),
    turnCount: 3, // 이번이 4번째(=max) 턴
    accumulated: ['EMOTION'] as ThinkingElement[],
  };
  const result = evaluateTurn(lastTurn, scene, analysis(['EMOTION']));
  expect(result.nextState.turnCount).toBe(4);
  expect(result.decision.mode).toBe('CLOSING');
  expect(result.decision.sceneEndReason).toBe('MAX_TURNS');
});

test('required 전부 충족 시 최대 턴 전이라도 CLOSING(GOAL_MET) 조기 종료한다', () => {
  const almost = {
    ...initialRuleState(),
    turnCount: 1,
    accumulated: ['PERSPECTIVE', 'EMOTION', 'REASON'] as ThinkingElement[],
  };
  const result = evaluateTurn(almost, scene, analysis(['SOLUTION']));
  expect(result.decision.mode).toBe('CLOSING');
  expect(result.decision.sceneEndReason).toBe('GOAL_MET');
  expect(result.decision.missingElements).toEqual([]);
});

test('마지막 턴에서 목표를 충족하면 MAX_TURNS가 아니라 GOAL_MET으로 기록한다', () => {
  const lastTurn = {
    ...initialRuleState(),
    turnCount: 3,
    accumulated: ['PERSPECTIVE', 'EMOTION', 'REASON'] as ThinkingElement[],
  };
  const result = evaluateTurn(lastTurn, scene, analysis(['SOLUTION']));
  expect(result.decision.mode).toBe('CLOSING');
  expect(result.decision.sceneEndReason).toBe('GOAL_MET');
});

test('CLOSING이 아니면 sceneEndReason이 없다', () => {
  const result = evaluateTurn(initialRuleState(), scene, analysis(['EMOTION']));
  expect(result.decision.sceneEndReason).toBeUndefined();
});
