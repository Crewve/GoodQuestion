// POST /api/profiles — 프로필 저장 (T046, contracts/api-routes.md 쓰기 통일 경로)
// 회원가입 2단계(T045)·아이 프로필 추가(T047 예정)가 공용 호출한다.
// 기록: parents(없을 때만 생성) / children(avatar_key·birth_date·파생 birth_year) / child_consents(아이별 1행).
// 보호자당 아이 총원 3명 제한은 여기서 최종 강제 (화면 제한과 별개 — 프로필 추가 경로 대비).
import { MAX_CHILDREN_PER_PARENT, parseProfilesPayload } from '@/lib/auth/profiles-payload';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';

/** 동의 안내문 버전·확인 방식 — Notion 설계서 child_consents 예시값 (로그인 보호자 온라인 동의) */
const CONSENT_VERSION = 'mvp_v1';
const VERIFICATION_METHOD = 'authenticated_parent';

function errorJson(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) return errorJson(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'BAD_REQUEST', '요청 본문이 JSON이 아닙니다.');
  }
  const parsed = parseProfilesPayload(body);
  if (!parsed.ok) return errorJson(400, 'BAD_REQUEST', parsed.message);

  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();

  // 보호자 행 — parents.id = auth.users.id 1:1 (R-10). 이미 있으면 유지(created_at·name 보존).
  // name은 가입 폼에 수집 항목이 없어 이메일 로컬파트로 대체 (내정보 3.1은 로그인 방식 문구만 노출).
  const { data: existingParent } = await admin
    .from('parents')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();
  if (!existingParent) {
    const { error: parentError } = await admin.from('parents').insert({
      id: user.id,
      name: user.email?.split('@')[0] ?? '보호자',
      created_at: now, // 스키마 기본값 없음 (Notion 설계서 원형 — R-11)
    });
    if (parentError) return errorJson(502, 'DB_ERROR', `보호자 저장 실패: ${parentError.message}`);
  }

  // 총원 제한 — 기존 아이 수 + 신규 등록 수 ≤ 3 (T047 프로필 추가 경로 포함 최종 방어선)
  const { count, error: countError } = await admin
    .from('children')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', user.id);
  if (countError) return errorJson(502, 'DB_ERROR', `아이 수 조회 실패: ${countError.message}`);
  if ((count ?? 0) + parsed.children.length > MAX_CHILDREN_PER_PARENT) {
    return errorJson(400, 'BAD_REQUEST', '아이는 최대 3명까지 등록할 수 있습니다.');
  }

  const childRows = parsed.children.map((child) => ({
    id: crypto.randomUUID(), // id·타임스탬프는 DB 기본값 없음 — 클라이언트 생성 (시드와 동일)
    parent_id: user.id,
    name: child.name,
    birth_year: child.birthYear,
    birth_date: child.birthDate,
    avatar_key: child.avatarKey,
    created_at: now,
  }));
  const { data: inserted, error: childError } = await admin
    .from('children')
    .insert(childRows)
    .select('id, name, avatar_key, birth_date');
  if (childError) return errorJson(502, 'DB_ERROR', `아이 프로필 저장 실패: ${childError.message}`);

  // 아동 동의 — UI는 화면 공통 1회 체크지만 DB는 아이별 1행 (Notion 설계서 §3)
  const consentRows = childRows.map((child) => ({
    id: crypto.randomUUID(),
    child_id: child.id,
    consent_version: CONSENT_VERSION,
    verification_method: VERIFICATION_METHOD,
    consented_at: now,
    withdrawn_at: null,
  }));
  const { error: consentError } = await admin.from('child_consents').insert(consentRows);
  if (consentError) return errorJson(502, 'DB_ERROR', `동의 기록 저장 실패: ${consentError.message}`);

  return Response.json({ children: inserted }, { status: 201 });
}
