import { describe, expect, it } from 'vitest';
import { givenName, isValidBirthDate, koreanAge } from './profile-display';

describe('givenName', () => {
  it('한글 3글자 이상 — 첫 글자(성) 제외 (기능명세서 2.0 예: 김민지→민지)', () => {
    expect(givenName('김민지')).toBe('민지');
    expect(givenName('남궁민수')).toBe('궁민수'); // 복성 분리는 MVP 범위 밖 — 단순 첫 글자 규칙
  });

  it('2글자 이하·영문 — 성 분리 불가라 원본 유지', () => {
    expect(givenName('김하')).toBe('김하');
    expect(givenName('Amy')).toBe('Amy');
  });
});

describe('koreanAge', () => {
  const today = new Date(2026, 7, 11); // 2026-08-11

  it('생일 지남/안 지남 경계', () => {
    expect(koreanAge('20200811', today)).toBe(6); // 오늘이 생일 — 만 나이 도달
    expect(koreanAge('20200812', today)).toBe(5);
    expect(koreanAge('20200101', today)).toBe(6);
  });

  it('DATE 컬럼 조회값(YYYY-MM-DD)도 동일 계산', () => {
    expect(koreanAge('2020-08-11', today)).toBe(6);
  });

  it('형식 불량·미래 날짜·150세 이상은 null (배지 미표시 — 2.1 유효성)', () => {
    expect(koreanAge('2020811', today)).toBeNull();
    expect(koreanAge('20201301', today)).toBeNull();
    expect(koreanAge(null, today)).toBeNull();
    expect(koreanAge('20270101', today)).toBeNull();
    expect(koreanAge('18700101', today)).toBeNull();
  });
});

describe('isValidBirthDate', () => {
  const today = new Date(2026, 7, 11);

  it('존재하는 과거 날짜만 통과, 달력에 없는 날짜·미래는 거부 (2.1.1)', () => {
    expect(isValidBirthDate('20190101', today)).toBe(true);
    expect(isValidBirthDate('20190230', today)).toBe(false); // 2월 30일 없음
    expect(isValidBirthDate('20270101', today)).toBe(false);
    expect(isValidBirthDate('2019011', today)).toBe(false);
  });
});
