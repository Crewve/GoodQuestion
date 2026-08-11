// T045 회원가입 검증 규칙 (기능명세서 1.2.1·1.2.2) — LLM·네트워크 무관 순수 함수.
// 에러 문구는 기능명세서 명시 문구 그대로 (UI가 필드 하단에 그대로 노출).
// 이메일 중복("이미 가입한 이메일입니다")은 서버(Supabase Auth) 판정이라 여기 없음 — 화면에서 처리.
import type { AvatarKey } from '@/lib/assets';

export const MSG = {
  EMAIL_FORMAT: '올바른 이메일 형식을 입력해주세요',
  PASSWORD_FORMAT: '영문, 숫자, 특수문자를 포함해 8~20자로 입력해주세요',
  PASSWORD_MISMATCH: '비밀번호가 일치하지 않습니다',
  TERMS_REQUIRED: '필수 약관에 모두 동의해주세요', // 1단계 다음 클릭
  BIRTH_LENGTH: '생년월일 8자리를 입력해주세요 (예: 20190101)',
  BIRTH_INVALID: '올바른 생년월일을 입력해주세요',
  CHILD_AVATAR: '캐릭터를 선택해주세요',
  CHILD_NAME: '아이 이름을 입력해주세요',
  CHILD_CONSENT: '필수 약관에 동의해주세요', // 2단계 회원가입 클릭 시 아동 동의 미체크
} as const;

export type FieldError = string | null;

/** ~@~ 형식 (1.2.1) — 실제 수신 가능 여부는 Supabase Auth가 최종 판정 */
export function validateEmail(email: string): FieldError {
  return /^\S+@\S+\.\S+$/.test(email.trim()) ? null : MSG.EMAIL_FORMAT;
}

/** 영문+숫자+특수문자 포함 8~20자, 공백 불가 (1.2.1 + 로그인 1.1 공백 규칙) */
export function validatePassword(password: string): FieldError {
  const ok =
    password.length >= 8 &&
    password.length <= 20 &&
    !/\s/.test(password) &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9\s]/.test(password);
  return ok ? null : MSG.PASSWORD_FORMAT;
}

export function validatePasswordConfirm(password: string, confirm: string): FieldError {
  return password === confirm ? null : MSG.PASSWORD_MISMATCH;
}

/** 생년월일 입력 차단 규칙 — 전각 숫자 정규화 후 숫자 외 즉시 제거, 8자리 절단 (1.2.2 "입력 자체를 차단") */
export function sanitizeBirthDateInput(raw: string): string {
  return raw
    .replace(/[０-９]/g, (ch) => String(ch.charCodeAt(0) - 0xff10))
    .replace(/\D/g, '')
    .slice(0, 8);
}

/** 8자리(YYYYMMDD)·실존 날짜·미래 불가 (1.2.2). today는 테스트 주입용 */
export function validateBirthDate(birthDate: string, today: Date = new Date()): FieldError {
  if (!/^\d{8}$/.test(birthDate)) return MSG.BIRTH_LENGTH;
  const year = Number(birthDate.slice(0, 4));
  const month = Number(birthDate.slice(4, 6));
  const day = Number(birthDate.slice(6, 8));
  const date = new Date(year, month - 1, day);
  const exists =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  if (!exists) return MSG.BIRTH_INVALID;
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (date.getTime() > todayEnd.getTime()) return MSG.BIRTH_INVALID;
  return null;
}

export type ChildDraft = {
  avatar: AvatarKey | null;
  name: string;
  birthDate: string;
};

export type ChildFieldErrors = {
  avatar: FieldError;
  name: FieldError;
  birthDate: FieldError;
};

/** 탭 1개의 필수 항목(캐릭터·이름·생년월일) 검사 — 아이 추가하기 클릭 시 대상 (동의 제외) */
export function validateChild(child: ChildDraft, today: Date = new Date()): ChildFieldErrors {
  return {
    avatar: child.avatar ? null : MSG.CHILD_AVATAR,
    name: child.name.trim().length >= 1 ? null : MSG.CHILD_NAME,
    birthDate: validateBirthDate(child.birthDate, today),
  };
}

export function isChildValid(child: ChildDraft, today: Date = new Date()): boolean {
  const errors = validateChild(child, today);
  return !errors.avatar && !errors.name && !errors.birthDate;
}

/** 회원가입 클릭 시 전체 탭 검사 — 첫 미통과 탭 인덱스(자동 전환용), 전부 통과면 -1 */
export function firstInvalidChildIndex(children: ChildDraft[], today: Date = new Date()): number {
  return children.findIndex((child) => !isChildValid(child, today));
}

export type Step1Draft = {
  email: string;
  password: string;
  passwordConfirm: string;
  termsRequired: boolean;
};

/** 1단계 '다음' 버튼 활성 조건 — 모든 필수 필드 통과 + 필수 약관 동의 (1.2.1) */
export function isStep1Valid(step1: Step1Draft): boolean {
  return (
    !validateEmail(step1.email) &&
    !validatePassword(step1.password) &&
    !validatePasswordConfirm(step1.password, step1.passwordConfirm) &&
    step1.termsRequired
  );
}
