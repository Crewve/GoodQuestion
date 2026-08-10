// T026 — 서버 후처리 단위 테스트 (R-03, 계약 불변 조건 2)
// evidence 원문 인용 검증 · 중복 정리 · 약한 탐지 보정 · 허용값 밖 type 제거
import { expect, test } from 'vitest';
import { postprocessAnalysis, type RawAnalysis } from './postprocess';

const utterance = '며느리가 방귀를 참아서 너무 힘들었을 것 같아요';

function raw(detected: { type: string; evidence: string }[]): RawAnalysis {
  return {
    childIntent: '며느리 마음 공감',
    mainPoint: '참아서 힘들었을 것',
    detectedElements: detected,
    utteranceValidity: 'VALID',
  };
}

test('원문 부분 문자열인 evidence는 그대로 유지된다', () => {
  const result = postprocessAnalysis(utterance, raw([{ type: 'EMOTION', evidence: '너무 힘들었을 것 같아요' }]));
  expect(result.refined.detectedElements).toEqual([
    { type: 'EMOTION', evidence: '너무 힘들었을 것 같아요' },
  ]);
  expect(result.dropped).toEqual([]);
});

test('원문에 없는 evidence는 탐지째 제거되고 사유가 기록된다', () => {
  const result = postprocessAnalysis(utterance, raw([{ type: 'EMOTION', evidence: '슬펐을 것 같아요' }]));
  expect(result.refined.detectedElements).toEqual([]);
  expect(result.dropped).toEqual([
    { type: 'EMOTION', evidence: '슬펐을 것 같아요', reason: 'EVIDENCE_NOT_QUOTED' },
  ]);
});

test('띄어쓰기만 다른 evidence는 원문 표기로 보정해 유지한다 (STT 교정 오차 흡수)', () => {
  const result = postprocessAnalysis(utterance, raw([{ type: 'EMOTION', evidence: '너무힘들었을것 같아요' }]));
  expect(result.refined.detectedElements).toEqual([
    { type: 'EMOTION', evidence: '너무 힘들었을 것 같아요' },
  ]);
  expect(result.correctedCount).toBe(1);
});

test('같은 type 중복 탐지는 첫 건만 남긴다', () => {
  const result = postprocessAnalysis(
    utterance,
    raw([
      { type: 'EMOTION', evidence: '너무 힘들었을 것' },
      { type: 'EMOTION', evidence: '방귀를 참아서' },
    ]),
  );
  expect(result.refined.detectedElements).toEqual([{ type: 'EMOTION', evidence: '너무 힘들었을 것' }]);
  expect(result.dropped).toEqual([
    { type: 'EMOTION', evidence: '방귀를 참아서', reason: 'DUPLICATE' },
  ]);
});

test('8요소 허용값 밖 type은 제거된다 (예: EXPRESSION 오기 — R-08)', () => {
  const result = postprocessAnalysis(utterance, raw([{ type: 'EXPRESSION', evidence: '방귀를 참아서' }]));
  expect(result.refined.detectedElements).toEqual([]);
  expect(result.dropped[0].reason).toBe('INVALID_TYPE');
});

test('한 글자 이하의 약한 evidence는 제거된다', () => {
  const result = postprocessAnalysis(utterance, raw([{ type: 'REASON', evidence: '방' }]));
  expect(result.refined.detectedElements).toEqual([]);
  expect(result.dropped[0].reason).toBe('WEAK_EVIDENCE');
});

test('나머지 3필드(childIntent/mainPoint/utteranceValidity)는 손대지 않고 통과시킨다', () => {
  const result = postprocessAnalysis(utterance, raw([]));
  expect(result.refined.childIntent).toBe('며느리 마음 공감');
  expect(result.refined.mainPoint).toBe('참아서 힘들었을 것');
  expect(result.refined.utteranceValidity).toBe('VALID');
});
