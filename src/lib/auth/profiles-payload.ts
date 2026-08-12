// T046 프로필 저장 페이로드 검증·정규화 (POST /api/profiles) — 순수 함수.
// 개별 필드 규칙은 signup-validation(T045)을 재사용해 화면·서버가 같은 기준을 쓴다.
// T047 아이 프로필 추가 폼도 같은 페이로드로 호출한다 (2.1.1 폼 재사용).
import type { AvatarKey } from '@/lib/assets';
import { validateBirthDate, validateChild } from './signup-validation';

const AVATAR_KEYS: readonly AvatarKey[] = ['boy-1', 'boy-2', 'girl-1', 'girl-2'];

export const MAX_CHILDREN_PER_PARENT = 3;

export type NormalizedChild = {
  name: string;
  avatarKey: AvatarKey;
  /** children.birth_date(date 타입)용 ISO 표기 */
  birthDate: string;
  /** children.birth_year(필수 컬럼, Notion 설계서 원형) — birth_date에서 파생 */
  birthYear: number;
};

export type ProfilesPayloadResult =
  | { ok: true; children: NormalizedChild[] }
  | { ok: false; message: string };

export type ChildUpdateResult =
  | { ok: true; child: NormalizedChild }
  | { ok: false; message: string };

/** 아이 1명 원시 값 → 검증·정규화 — 등록(POST)·수정(PATCH) 공통 규칙 */
function normalizeChild(raw: unknown, today: Date): ChildUpdateResult {
  const child = (typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? raw : {}) as {
    name?: unknown;
    avatar_key?: unknown;
    birth_date?: unknown;
  };
  const name = typeof child.name === 'string' ? child.name.trim() : '';
  const avatarKey = child.avatar_key as AvatarKey;
  const birthDate = typeof child.birth_date === 'string' ? child.birth_date : '';

  if (!AVATAR_KEYS.includes(avatarKey)) {
    return { ok: false, message: '캐릭터 선택이 올바르지 않습니다.' };
  }
  // 이름·생년월일은 화면(T045)과 동일 규칙 — 검증 실패 문구도 명세 문구 재사용
  const errors = validateChild({ avatar: avatarKey, name, birthDate }, today);
  const firstError = errors.name ?? errors.birthDate ?? validateBirthDate(birthDate, today);
  if (firstError) return { ok: false, message: firstError };

  return {
    ok: true,
    child: {
      name,
      avatarKey,
      birthDate: `${birthDate.slice(0, 4)}-${birthDate.slice(4, 6)}-${birthDate.slice(6, 8)}`,
      birthYear: Number(birthDate.slice(0, 4)),
    },
  };
}

/**
 * PATCH /api/profiles/[childId] 본문 검증 — 수정 폼이 전체 필드를 제출한다(부분 수정 아님).
 * 동의(child_consents)는 등록 시 1회 기록을 유지하므로 재요구하지 않는다.
 */
export function parseChildUpdatePayload(body: unknown, today: Date = new Date()): ChildUpdateResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, message: '요청 본문 형식이 올바르지 않습니다.' };
  }
  return normalizeChild(body, today);
}

/** 요청 본문 → 검증·정규화. 실패 메시지는 400 응답 본문으로 그대로 나간다. */
export function parseProfilesPayload(body: unknown, today: Date = new Date()): ProfilesPayloadResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, message: '요청 본문 형식이 올바르지 않습니다.' };
  }
  const { children, child_consent } = body as { children?: unknown; child_consent?: unknown };

  if (!Array.isArray(children) || children.length === 0) {
    return { ok: false, message: '아이 정보가 최소 1명 필요합니다.' };
  }
  if (children.length > MAX_CHILDREN_PER_PARENT) {
    return { ok: false, message: '아이는 최대 3명까지 등록할 수 있습니다.' };
  }
  if (child_consent !== true) {
    return { ok: false, message: '아동 개인정보 수집·이용 동의가 필요합니다.' };
  }

  const normalized: NormalizedChild[] = [];
  for (const raw of children) {
    const result = normalizeChild(raw, today);
    if (!result.ok) return result;
    normalized.push(result.child);
  }
  return { ok: true, children: normalized };
}
