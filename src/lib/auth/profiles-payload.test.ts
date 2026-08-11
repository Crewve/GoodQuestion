// T046 프로필 저장 페이로드 검증 테스트 — POST /api/profiles 요청 본문 파싱·정규화.
// 검증 규칙은 signup-validation(T045)을 재사용해 화면과 서버가 같은 기준을 쓴다.
import { describe, expect, test } from 'vitest';
import { parseProfilesPayload } from './profiles-payload';

const TODAY = new Date(2026, 7, 11);

const validChild = { name: '김하늘', avatar_key: 'boy-1', birth_date: '20200315' };

function parse(body: unknown) {
  return parseProfilesPayload(body, TODAY);
}

describe('parseProfilesPayload — 정상 경로', () => {
  test('아이 1명: 정규화된 값 반환 (ISO 날짜·출생연도 파생·이름 트림)', () => {
    const result = parse({ children: [{ ...validChild, name: '  김하늘 ' }], child_consent: true });
    expect(result).toEqual({
      ok: true,
      children: [{ name: '김하늘', avatarKey: 'boy-1', birthDate: '2020-03-15', birthYear: 2020 }],
    });
  });

  test('아이 3명까지 허용', () => {
    const result = parse({ children: [validChild, validChild, validChild], child_consent: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.children).toHaveLength(3);
  });
});

describe('parseProfilesPayload — 거부 경로', () => {
  test('본문이 객체가 아니면 거부', () => {
    expect(parse(null).ok).toBe(false);
    expect(parse('text').ok).toBe(false);
  });

  test('아이 0명이면 거부', () => {
    const result = parse({ children: [], child_consent: true });
    expect(result).toEqual({ ok: false, message: '아이 정보가 최소 1명 필요합니다.' });
  });

  test('아이 4명이면 거부 (최대 3명)', () => {
    const result = parse({
      children: [validChild, validChild, validChild, validChild],
      child_consent: true,
    });
    expect(result).toEqual({ ok: false, message: '아이는 최대 3명까지 등록할 수 있습니다.' });
  });

  test('아동 동의 없으면 거부', () => {
    const result = parse({ children: [validChild], child_consent: false });
    expect(result).toEqual({ ok: false, message: '아동 개인정보 수집·이용 동의가 필요합니다.' });
    expect(parse({ children: [validChild] }).ok).toBe(false);
  });

  test('아바타 키가 4종 밖이면 거부', () => {
    const result = parse({ children: [{ ...validChild, avatar_key: 'cat-1' }], child_consent: true });
    expect(result).toEqual({ ok: false, message: '캐릭터 선택이 올바르지 않습니다.' });
  });

  test('이름이 비어 있으면 거부', () => {
    const result = parse({ children: [{ ...validChild, name: ' ' }], child_consent: true });
    expect(result.ok).toBe(false);
  });

  test('생년월일 형식·실존·미래 검증은 화면과 동일 규칙', () => {
    expect(parse({ children: [{ ...validChild, birth_date: '2020031' }], child_consent: true }).ok).toBe(false);
    expect(parse({ children: [{ ...validChild, birth_date: '20230230' }], child_consent: true }).ok).toBe(false);
    expect(parse({ children: [{ ...validChild, birth_date: '20260812' }], child_consent: true }).ok).toBe(false);
  });
});
