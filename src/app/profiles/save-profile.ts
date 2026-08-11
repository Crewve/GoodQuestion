// 아이 프로필 저장 호출부 (T047) — 파트2 T046 POST /api/profiles 계약(2026-08-11 팀원 브랜치 확정)에 맞춘다:
// 요청 { children: [{ name, avatar_key, birth_date: 'YYYYMMDD' }], child_consent: true }
// 응답 201 { children: [{ id, name, avatar_key, birth_date }] } — 2.1.1은 1명씩이라 단건 래핑.
// T046이 develop 합류 전(라우트 부재 404)에는 NOT_READY로 화면이 "준비 중" 안내를 띄운다.
import type { AvatarKey } from '@/lib/assets';

export type SaveChildProfileInput = {
  name: string;
  /** YYYYMMDD 8자리 (기능명세서 2.1.1 — 만 나이 배지 계산 원천) */
  birthDate: string;
  avatarKey: AvatarKey;
  /** 아동 개인정보 처리 동의 — 1회 저장 (child_consents) */
  consent: true;
};

export type SaveChildProfileResult =
  | { ok: true; childId: string }
  | { ok: false; reason: 'NOT_READY' | 'ERROR'; message?: string };

export async function saveChildProfile(input: SaveChildProfileInput): Promise<SaveChildProfileResult> {
  let res: Response;
  try {
    res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        children: [{ name: input.name, avatar_key: input.avatarKey, birth_date: input.birthDate }],
        child_consent: input.consent,
      }),
    });
  } catch {
    return { ok: false, reason: 'ERROR' };
  }
  // 라우트 미합류(T046 머지 전) — 화면은 "준비 중" 안내로 분기
  if (res.status === 404 || res.status === 501) return { ok: false, reason: 'NOT_READY' };
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    return { ok: false, reason: 'ERROR', message: body?.error?.message };
  }
  const body = (await res.json()) as { children: { id: string }[] };
  const childId = body.children?.[0]?.id;
  if (!childId) return { ok: false, reason: 'ERROR' };
  return { ok: true, childId };
}
