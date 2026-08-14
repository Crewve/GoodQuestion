// T045 회원가입 검증 규칙 테스트 — 기능명세서 1.2.1(계정 생성)·1.2.2(아이 프로필 추가) 유효성 조건.
// 에러 문구는 기능명세서 명시 문구와 글자 단위로 일치해야 한다 (UI가 그대로 노출).
import { describe, expect, test } from 'vitest';
import {
  MSG,
  firstInvalidChildIndex,
  isChildValid,
  isStep1Valid,
  sanitizeBirthDateInput,
  validateBirthDate,
  validateChild,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  type ChildDraft,
} from './signup-validation';

// 미래 날짜 판정 고정 기준일 (2026-08-11)
const TODAY = new Date(2026, 7, 11);

const validChild: ChildDraft = { avatar: 'boy-1', name: '김하늘', birthDate: '20200315' };

describe('validateEmail — ~@~ 형식 필수 (1.2.1)', () => {
  test('정상 이메일은 통과', () => {
    expect(validateEmail('parent@example.com')).toBeNull();
  });

  test('@ 없는 문자열은 실패', () => {
    expect(validateEmail('parent.example.com')).toBe(MSG.EMAIL_FORMAT);
  });

  test('빈 값은 실패', () => {
    expect(validateEmail('')).toBe(MSG.EMAIL_FORMAT);
  });
});

describe('validatePassword — 영문+숫자+특수문자, 8~20자 (1.2.1)', () => {
  test('세 종류 포함 8자 이상이면 통과', () => {
    expect(validatePassword('abcd123!')).toBeNull();
  });

  test('특수문자 없으면 실패', () => {
    expect(validatePassword('abcd1234')).toBe(MSG.PASSWORD_FORMAT);
  });

  test('숫자 없으면 실패', () => {
    expect(validatePassword('abcdefg!')).toBe(MSG.PASSWORD_FORMAT);
  });

  test('영문 없으면 실패', () => {
    expect(validatePassword('1234567!')).toBe(MSG.PASSWORD_FORMAT);
  });

  test('7자는 실패, 21자는 실패, 경계 8·20자는 통과', () => {
    expect(validatePassword('abc123!')).toBe(MSG.PASSWORD_FORMAT); // 7자
    expect(validatePassword('a1!' + 'x'.repeat(18))).toBe(MSG.PASSWORD_FORMAT); // 21자
    expect(validatePassword('abcde12!')).toBeNull(); // 8자
    expect(validatePassword('a1!' + 'x'.repeat(17))).toBeNull(); // 20자
  });

  test('공백 포함은 실패 (로그인 1.1 공백 불가 규칙과 정합)', () => {
    expect(validatePassword('abcd 123!')).toBe(MSG.PASSWORD_FORMAT);
  });
});

describe('validatePasswordConfirm — 비밀번호 필드와 값 일치 (1.2.1)', () => {
  test('일치하면 통과', () => {
    expect(validatePasswordConfirm('abcd123!', 'abcd123!')).toBeNull();
  });

  test('불일치하면 명세 문구 반환', () => {
    expect(validatePasswordConfirm('abcd123!', 'abcd123?')).toBe(MSG.PASSWORD_MISMATCH);
  });
});

describe('sanitizeBirthDateInput — 숫자만·8자리 절단 (1.2.2 입력 차단)', () => {
  test('숫자 외 문자는 즉시 제거', () => {
    expect(sanitizeBirthDateInput('2020-03-15')).toBe('20200315');
    expect(sanitizeBirthDateInput('２0a20억03떡15')).toBe('20200315');
  });

  test('8자리 초과분은 절단', () => {
    expect(sanitizeBirthDateInput('202003159')).toBe('20200315');
  });
});

describe('validateBirthDate — 8자리·실존 날짜·미래 불가 (1.2.2)', () => {
  test('정상 생년월일은 통과', () => {
    expect(validateBirthDate('20200315', TODAY)).toBeNull();
  });

  test('8자리 미만이면 자리수 안내 문구', () => {
    expect(validateBirthDate('2020031', TODAY)).toBe(MSG.BIRTH_LENGTH);
    expect(validateBirthDate('', TODAY)).toBe(MSG.BIRTH_LENGTH);
  });

  test('존재하지 않는 날짜(2월 30일)는 실패', () => {
    expect(validateBirthDate('20230230', TODAY)).toBe(MSG.BIRTH_INVALID);
  });

  test('미래 날짜는 실패, 기준일 당일은 통과', () => {
    expect(validateBirthDate('20260812', TODAY)).toBe(MSG.BIRTH_INVALID);
    expect(validateBirthDate('20260811', TODAY)).toBeNull();
  });
});

describe('validateChild — 탭 1개의 필수 항목 검사 (아이 추가하기 클릭 시 대상)', () => {
  test('전부 유효하면 에러 없음', () => {
    const errors = validateChild(validChild, TODAY);
    expect(errors).toEqual({ avatar: null, name: null, birthDate: null });
    expect(isChildValid(validChild, TODAY)).toBe(true);
  });

  test('캐릭터 미선택이면 명세 문구', () => {
    expect(validateChild({ ...validChild, avatar: null }, TODAY).avatar).toBe(MSG.CHILD_AVATAR);
  });

  test('이름 미입력(공백만 포함)이면 명세 문구', () => {
    expect(validateChild({ ...validChild, name: '  ' }, TODAY).name).toBe(MSG.CHILD_NAME);
  });

  test('생년월일 에러는 validateBirthDate 결과를 그대로 사용', () => {
    expect(validateChild({ ...validChild, birthDate: '2020' }, TODAY).birthDate).toBe(MSG.BIRTH_LENGTH);
  });
});

describe('firstInvalidChildIndex — 회원가입 클릭 시 전체 탭 검사 순서', () => {
  test('모두 유효하면 -1', () => {
    expect(firstInvalidChildIndex([validChild, validChild], TODAY)).toBe(-1);
  });

  test('앞 탭부터 검사해 첫 미통과 탭 인덱스 반환 (오류 탭 자동 전환용)', () => {
    const broken: ChildDraft = { ...validChild, name: '' };
    expect(firstInvalidChildIndex([validChild, broken, broken], TODAY)).toBe(1);
  });
});

describe('isStep1Valid — 다음 버튼 활성 조건 (1.2.1)', () => {
  const valid = {
    email: 'parent@example.com',
    password: 'abcd123!',
    passwordConfirm: 'abcd123!',
    termsRequired: true,
  };

  test('모든 필수 필드 통과 + 필수 약관 동의 시 활성', () => {
    expect(isStep1Valid(valid)).toBe(true);
  });

  test('필수 약관 미동의면 비활성', () => {
    expect(isStep1Valid({ ...valid, termsRequired: false })).toBe(false);
  });

  test('필드 하나라도 미통과면 비활성', () => {
    expect(isStep1Valid({ ...valid, passwordConfirm: 'abcd123?' })).toBe(false);
  });
});
