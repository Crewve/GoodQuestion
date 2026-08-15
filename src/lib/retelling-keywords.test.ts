import { describe, expect, test } from 'vitest';

import story from '../../fixtures/story.banggui.json';
import { keywordIncluded, keywordVariants } from './retelling-keywords';
import { buildSttHint, retellingVocabulary } from './stt/hints';

// QA 12 / 피그마 코멘트 #84 — 장면당 핵심 단어 2~4개 확장분이 "발화 시 인식"되는지 검증.
// SoT는 fixtures post_activity_config.keywords — 콘텐츠가 바뀌면 이 테스트가 자동으로 따라간다.

type Config = { keywords: string[][] };
const config = (story as { story: { post_activity_config: Config } }).story.post_activity_config;
const allKeywords = config.keywords.flat();

describe('post_activity_config.keywords — QA 12 확장 형태', () => {
  test('장면당 묶음(string[][])이고 각 장면 2~4개', () => {
    expect(config.keywords.length).toBeGreaterThanOrEqual(4);
    for (const group of config.keywords) {
      expect(group.length).toBeGreaterThanOrEqual(2);
      expect(group.length).toBeLessThanOrEqual(4);
    }
  });
});

describe('keywordIncluded — 발화 전사 텍스트에서 키워드 인식', () => {
  test('원형 그대로 말한 경우 전부 인식', () => {
    for (const keyword of allKeywords) {
      expect(keywordIncluded(`며느리는 ${keyword}이라고 말했어요`, keyword)).toBe(true);
    }
  });

  test('조사가 붙어도 인식 (부분 문자열)', () => {
    expect(keywordIncluded('며느리는 걱정이 많았어요', '걱정')).toBe(true);
    expect(keywordIncluded('지혜로운 방법을 찾았어요', '지혜')).toBe(true);
    expect(keywordIncluded('지혜로운 방법을 찾았어요', '방법')).toBe(true);
    expect(keywordIncluded('실수해도 괜찮다고 했어요', '실수')).toBe(true);
  });

  test('명사형 키워드의 활용형 발화 인식 — 미안함·부끄러움·놀람', () => {
    expect(keywordIncluded('가족들에게 미안하다고 했어요', '미안함')).toBe(true);
    expect(keywordIncluded('시아버지에게 미안했어요', '미안함')).toBe(true);
    expect(keywordIncluded('며느리는 방귀가 부끄러웠어요', '부끄러움')).toBe(true);
    expect(keywordIncluded('부끄럽지 않게 됐어요', '부끄러움')).toBe(true);
    expect(keywordIncluded('가족들이 깜짝 놀랐어요', '놀람')).toBe(true);
    expect(keywordIncluded('모두 놀라서 소리쳤어요', '놀람')).toBe(true);
  });

  test('띄어쓰기 차이 무시', () => {
    expect(keywordIncluded('부끄러 움이 많았어요', '부끄러움')).toBe(true);
  });

  test('없는 단어는 미인식', () => {
    expect(keywordIncluded('며느리는 방귀를 뀌었어요', '걱정')).toBe(false);
    expect(keywordIncluded('', '걱정')).toBe(false);
  });

  test('변형 생성 — 원형은 항상 포함', () => {
    for (const keyword of allKeywords) {
      expect(keywordVariants(keyword)).toContain(keyword);
    }
  });
});

describe('retelling STT 어휘 힌트 — 키워드가 힌트 끝(가장 강한 위치)에 실린다', () => {
  test('retellingVocabulary가 모든 핵심 단어를 포함', () => {
    const vocab = retellingVocabulary();
    for (const keyword of allKeywords) {
      expect(vocab).toContain(keyword);
    }
  });

  test('buildSttHint(retelling)가 잘림(180자) 후에도 핵심 단어를 유지', () => {
    const hint = buildSttHint('sc_banggui_08', undefined, retellingVocabulary());
    for (const keyword of allKeywords) {
      expect(hint).toContain(keyword);
    }
  });
});
