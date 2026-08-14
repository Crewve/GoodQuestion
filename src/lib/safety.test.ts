// T075 — 입력측 부적절 발화 스크리닝 (E2E 항목 24)
// 판정만 한다: 차단·저장 배제 없음. 걸리면 생성 프롬프트가 '따라 말하지 않고 주제 복귀'로 처리한다.
import { expect, test } from 'vitest';
import { containsInappropriateLanguage } from './safety';

test('비속어·욕설이 포함된 발화를 탐지한다', () => {
  expect(containsInappropriateLanguage('바보 멍청이 방귀쟁이래요')).toBe(true);
  expect(containsInappropriateLanguage('아 씨발 몰라')).toBe(true);
  expect(containsInappropriateLanguage('꺼져 이 병신아')).toBe(true);
  expect(containsInappropriateLanguage('죽어버려')).toBe(true);
});

test('정상 발화는 통과한다', () => {
  expect(containsInappropriateLanguage('며느리가 힘들었을 것 같아요')).toBe(false);
  expect(containsInappropriateLanguage('방귀로 배를 떨어뜨리면 돼요')).toBe(false);
  expect(containsInappropriateLanguage('몰라요')).toBe(false);
});

test('공백·빈 문자열은 통과한다', () => {
  expect(containsInappropriateLanguage('')).toBe(false);
  expect(containsInappropriateLanguage('   ')).toBe(false);
});
