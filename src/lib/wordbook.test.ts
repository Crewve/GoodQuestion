// 단어장 fixture 정합성 테스트 (2.6) — 콘텐츠 데이터가 에셋·이야기 규약과 어긋나면 빌드 전에 잡는다.
import { describe, expect, test } from 'vitest';
import { BANGGUI_STORY_ID } from './story';
import {
  WORDBOOK_STORY_ID,
  quizSceneImageUrl,
  wordImageUrl,
  wordbookQuiz,
  wordbookWords,
} from './wordbook';

describe('단어장 fixture 정합성', () => {
  test('이야기 uuid가 방귀 뀌는 며느리와 일치', () => {
    expect(WORDBOOK_STORY_ID).toBe(BANGGUI_STORY_ID);
  });

  test('단어 5종 — 필수 필드·이미지 키가 storage 매핑에 존재', () => {
    const words = wordbookWords();
    expect(words).toHaveLength(5);
    for (const word of words) {
      expect(word.word.length).toBeGreaterThan(0);
      expect(word.definition.length).toBeGreaterThan(0);
      expect(word.story_quote).toContain(word.word.replace(/하다$|스럽다$/, '')); // 인용문에 단어 어간 포함
      expect(() => wordImageUrl(word)).not.toThrow(); // assetUrl은 미등록 키에 throw
    }
  });

  test('퀴즈 5문항 — 빈칸·보기 4개·정답 범위·장면 이미지 해석 가능', () => {
    const quiz = wordbookQuiz();
    expect(quiz).toHaveLength(5);
    for (const item of quiz) {
      expect(item.question).toContain('□');
      expect(item.choices).toHaveLength(4);
      expect(item.answer_index).toBeGreaterThanOrEqual(0);
      expect(item.answer_index).toBeLessThan(4);
      expect(new Set(item.choices).size).toBe(4); // 보기 중복 없음
      expect(() => quizSceneImageUrl(item)).not.toThrow();
    }
  });

  test('external_id 중복 없음', () => {
    const ids = [...wordbookWords().map((w) => w.external_id), ...wordbookQuiz().map((q) => q.external_id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
