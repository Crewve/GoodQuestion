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

/** 응답으로 받은 저장 결과 — 목록 화면이 refresh를 기다리지 않고 바로 카드를 그리는 원천 (QA 2) */
export type SavedChildProfile = {
  id: string;
  name: string;
  /** children.birth_date DATE 조회값 'YYYY-MM-DD' — 만 나이 배지 계산 원천 */
  birthDate: string | null;
  avatarKey: string | null;
};

export type SaveChildProfileResult =
  | { ok: true; childId: string; profile: SavedChildProfile }
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
  const body = (await res.json()) as {
    children: { id: string; name: string; avatar_key: string | null; birth_date: string | null }[];
  };
  const created = body.children?.[0];
  if (!created?.id) return { ok: false, reason: 'ERROR' };
  return {
    ok: true,
    childId: created.id,
    // 201 응답이 저장 확정본을 그대로 돌려주므로 목록 카드를 즉시 그릴 수 있다 (router.refresh 대기 불필요)
    profile: {
      id: created.id,
      name: created.name ?? input.name,
      birthDate: created.birth_date ?? null,
      avatarKey: created.avatar_key ?? null,
    },
  };
}
