// T049 이야기 목록·상세 뷰 로직 테스트 — 기능명세서 2.2(필터 AND·단일 선택)·2.3(줄거리 결합).
import { describe, expect, test } from 'vitest';
import { difficultyLabel, filterStories, summaryWithTagline, type StoryRow } from './stories-view';

const banggui: StoryRow = {
  id: 'uuid-1',
  title: '방귀 뀌는 며느리',
  summary: '큰 방귀를 부끄러워하던 며느리가 자신의 다름을 장점으로 바꾸는 이야기',
  difficulty: '보통',
  topics: ['다름', '자기이해', '장점 발견'],
  estimated_minutes: 20,
  status: 'published',
};

describe('difficultyLabel — DB 값(쉬움/보통/어려움) → 표시 라벨 (2.2 난이도 배지)', () => {
  test('3단계 매핑', () => {
    expect(difficultyLabel('쉬움')).toBe('새싹 이야기');
    expect(difficultyLabel('보통')).toBe('튼튼 이야기');
    expect(difficultyLabel('어려움')).toBe('도전 이야기');
  });

  test('이미 라벨이거나 미지의 값은 그대로', () => {
    expect(difficultyLabel('튼튼 이야기')).toBe('튼튼 이야기');
    expect(difficultyLabel('특별')).toBe('특별');
  });
});

describe('filterStories — 주제·난이도 단일 선택 AND (2.2)', () => {
  const draft: StoryRow = { ...banggui, id: 'uuid-2', status: 'draft' };
  const brave: StoryRow = { ...banggui, id: 'uuid-3', topics: ['용기'], difficulty: '쉬움' };

  test('전체/전체: published만 노출 (draft 제외)', () => {
    expect(filterStories([banggui, draft, brave], '전체', '전체')).toEqual([banggui, brave]);
  });

  test('주제 필터: topics 포함 여부', () => {
    expect(filterStories([banggui, brave], '다름', '전체')).toEqual([banggui]);
    expect(filterStories([banggui, brave], '용기', '전체')).toEqual([brave]);
    expect(filterStories([banggui, brave], '나눔', '전체')).toEqual([]);
  });

  test('난이도 필터: 라벨 기준 매칭', () => {
    expect(filterStories([banggui, brave], '전체', '튼튼 이야기')).toEqual([banggui]);
    expect(filterStories([banggui, brave], '전체', '새싹 이야기')).toEqual([brave]);
  });

  test('AND 조건: 두 필터 동시 만족만 노출', () => {
    expect(filterStories([banggui, brave], '다름', '튼튼 이야기')).toEqual([banggui]);
    expect(filterStories([banggui, brave], '다름', '새싹 이야기')).toEqual([]);
  });
});

describe('summaryWithTagline — 줄거리 + 고정 문구 한 문단 (2.3)', () => {
  test('summary 뒤에 고정 문구를 이어 붙인다', () => {
    expect(summaryWithTagline('짧은 줄거리.')).toBe(
      '짧은 줄거리. 이야기 속 캐릭터와 대화하며 나의 특별한 점을 찾아봐요!',
    );
  });
});
