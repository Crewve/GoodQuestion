// T025 — 분석 LLM 순수부 테스트: 프롬프트 조립·응답 파싱 (API 호출부는 simulate/eval CLI로 검증)
import { expect, test } from 'vitest';
import { buildAnalysisMessages, parseRawAnalysis } from './analysis';

const context = {
  sceneGoal: '며느리의 입장을 이해하고 공감한다',
  characterName: '며느리',
  characterQuestion: '가족들이 나를 이상하게 생각하지 않을까?',
  requiredElements: ['PERSPECTIVE', 'EMOTION'] as const,
};

test('프롬프트에 8요소 전체가 명문화된다 — required는 참고일 뿐 탐지 범위를 제한하지 않는다 (R-03)', () => {
  const messages = buildAnalysisMessages('며느리가 힘들었을 것 같아요', { ...context, requiredElements: [...context.requiredElements] });
  const all = messages.map((m) => m.content).join('\n');
  for (const element of ['DECISION', 'EMOTION', 'REASON', 'PERSPECTIVE', 'EMPATHY', 'SOLUTION', 'RESULT', 'REQUEST']) {
    expect(all).toContain(element);
  }
  expect(all).toContain('8');
});

test('프롬프트에 장면 목표·직전 캐릭터 질문·아이 발화가 포함된다', () => {
  const messages = buildAnalysisMessages('며느리가 힘들었을 것 같아요', { ...context, requiredElements: [...context.requiredElements] });
  const all = messages.map((m) => m.content).join('\n');
  expect(all).toContain(context.sceneGoal);
  expect(all).toContain(context.characterQuestion);
  expect(all).toContain('며느리가 힘들었을 것 같아요');
});

test('정상 JSON 응답은 RawAnalysis로 파싱된다', () => {
  const parsed = parseRawAnalysis(
    JSON.stringify({
      child_intent: 'EMOTION',
      main_point: '며느리가 힘들었을 것',
      detected_elements: [{ type: 'EMOTION', evidence: '힘들었을 것 같아요' }],
      utterance_validity: 'VALID',
    }),
  );
  expect(parsed.childIntent).toBe('EMOTION');
  expect(parsed.detectedElements).toEqual([{ type: 'EMOTION', evidence: '힘들었을 것 같아요' }]);
  expect(parsed.utteranceValidity).toBe('VALID');
});

test('4필드 중 하나라도 빠지면 예외를 던진다 (호출부 1회 재시도 근거)', () => {
  expect(() =>
    parseRawAnalysis(JSON.stringify({ child_intent: 'EMOTION', main_point: '요지', detected_elements: [] })),
  ).toThrow();
});

test('JSON이 아니면 예외를 던진다', () => {
  expect(() => parseRawAnalysis('분석해 드릴게요!')).toThrow();
});
