// 프로필 표시 규칙 헬퍼 (T047·T048 공용, 파트1) — 순수 함수라 클라이언트/서버 모두 사용 가능.
import { MAX_CHILDREN_PER_PARENT } from './auth/profiles-payload'; // 상대 경로 — vitest에 @ 별칭 설정이 없다

/**
 * 서버 목록 + 이번 화면에서 방금 등록한 아이 병합 (기능명세서 2.1.1 → 2.1 복귀).
 * router.refresh()는 await할 수 없어 목록 복귀 시점에는 아직 이전 서버 props가 렌더된다 —
 * 그 사이 신규 카드가 비어 보이는 문제(QA 2)를 없애려고 응답으로 받은 아이를 즉시 이어 붙인다.
 * refresh가 도착하면 같은 id가 서버 목록에 들어오므로 서버 값이 이기고 중복도 생기지 않는다.
 */
export function mergeAddedProfiles<T extends { id: string }>(serverProfiles: T[], added: T[]): T[] {
  const known = new Set(serverProfiles.map((profile) => profile.id));
  const pending = added.filter((profile) => !known.has(profile.id));
  return [...serverProfiles, ...pending].slice(0, MAX_CHILDREN_PER_PARENT); // 표시 상한도 서버 제한과 동일
}

/**
 * 인사말·홈 표시용 이름 — "name의 첫 글자(성) 제외 후 나머지 표시" (기능명세서 2.0, 예: 김민지→민지).
 * 성+이름 구조가 확실한 한글 3글자 이상에만 적용 — 2글자(외자)·영문 등은 원본 유지(한 글자 왜곡 방지).
 */
export function givenName(name: string): string {
  const trimmed = name.trim();
  const isHangul = /^[가-힣]+$/.test(trimmed);
  return isHangul && trimmed.length >= 3 ? trimmed.slice(1) : trimmed;
}

/**
 * 생년월일 → 만 나이 (기능명세서 2.1 배지 "만 6세").
 * 입력은 8자리 YYYYMMDD(폼 입력) 또는 YYYY-MM-DD(children.birth_date DATE 조회값) 둘 다 허용.
 * 계산값이 0세 미만(미래 날짜)·150세 이상이면 비정상 데이터 — null 반환(배지 미표시, 2.1 유효성).
 */
export function koreanAge(birthDate: string | null | undefined, today = new Date()): number | null {
  const digits = birthDate?.replaceAll('-', '');
  if (!digits || !/^\d{8}$/.test(digits)) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  let age = today.getFullYear() - year;
  const birthdayPassed =
    today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  if (!birthdayPassed) age -= 1;
  return age < 0 || age >= 150 ? null : age;
}

/** YYYYMMDD 8자리가 실제 존재하는 과거~오늘 날짜인지 (기능명세서 2.1.1 — 미래 날짜 불가) */
export function isValidBirthDate(digits: string, today = new Date()): boolean {
  if (!/^\d{8}$/.test(digits)) return false;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(year, month - 1, day);
  const exists =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return exists && date.getTime() <= today.getTime();
}
