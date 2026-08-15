// 네이버 로그인 콜백 (T082, 기능명세서 1.1.2) — 인가 코드를 받아 ① 네이버 토큰 교환
// ② 프로필(이메일) 조회 ③ Supabase 유저 확보(admin) ④ 세션 발급 순으로 처리한다.
// Supabase가 네이버 프로바이더를 지원하지 않아 세션은 admin generateLink(magiclink)로 메일 발송
// 없이 토큰 해시만 뽑아 verifyOtp로 즉시 검증해 만든다(email-exists 프로브와 같은 admin API 활용).
// 같은 이메일이 이미 있으면 그 계정으로 로그인한다 — 카카오·구글(검증된 이메일 자동 통합)과 동일
// 정책, 2026-08-15 팀 확인. 실패는 전부 기능명세서 1.1.2 예외 한 갈래(/login?error=social)로 수렴.
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getSupabaseServer } from '@/lib/supabase-server';
import { NAVER_COOKIE_PATH, NAVER_STATE_COOKIE, getNaverEnv, parseStateCookie, safeNext } from '@/lib/auth/naver';

type NaverToken = { access_token?: string };
type NaverProfile = {
  resultcode?: string;
  response?: { id?: string; email?: string; name?: string; nickname?: string };
};

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  // 실패·성공 공통으로 state 쿠키는 1회용 — 응답에서 항상 만료시킨다
  const redirectTo = (path: string) => {
    const response = NextResponse.redirect(new URL(path, url.origin));
    response.cookies.set(NAVER_STATE_COOKIE, '', { path: NAVER_COOKIE_PATH, maxAge: 0 });
    return response;
  };
  const fail = () => redirectTo('/login?error=social');

  const env = getNaverEnv();
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const saved = parseStateCookie(request.cookies.get(NAVER_STATE_COOKIE)?.value);
  // code 부재(사용자 취소 등)·state 불일치(CSRF/만료) — 로그인 화면에서 소셜 실패 문구 노출
  if (!env || !code || !state || !saved || saved.state !== state) return fail();

  // ① 인가 코드 → 액세스 토큰
  const tokenRes = await fetch('https://nid.naver.com/oauth2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: env.clientId,
      client_secret: env.clientSecret,
      code,
      state,
    }),
    cache: 'no-store',
  }).catch(() => null);
  const token = tokenRes?.ok ? ((await tokenRes.json().catch(() => null)) as NaverToken | null) : null;
  if (!token?.access_token) return fail();

  // ② 프로필 조회 — 이메일은 네이버 앱의 "필수 제공" 항목으로 등록해 동의 없이는 진입 불가
  const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: 'no-store',
  }).catch(() => null);
  const profile = profileRes?.ok ? ((await profileRes.json().catch(() => null)) as NaverProfile | null) : null;
  const email = profile?.resultcode === '00' ? profile.response?.email?.trim().toLowerCase() : undefined;
  const naverId = profile?.response?.id;
  if (!email || !naverId) return fail();

  // ③ 유저 확보 — 신규면 생성(네이버가 소유 검증한 이메일이라 confirm), 기존이면 그 계정 사용
  const admin = getSupabaseAdmin();
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    // 내정보 3.1 로그인 방식 문구가 app_metadata.provider를 읽는다 (T056 매핑에 naver 포함)
    app_metadata: { provider: 'naver', providers: ['naver'] },
    user_metadata: { full_name: profile?.response?.name ?? profile?.response?.nickname ?? null, naver_id: naverId },
  });
  if (createError && createError.code !== 'email_exists') return fail();

  // ④ 세션 발급 — 링크 생성만 하고 메일은 보내지 않으므로 SMTP 불필요
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return fail();

  const supabase = await getSupabaseServer();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'email', token_hash: tokenHash });
  if (verifyError) return fail();

  return redirectTo(safeNext(saved.next)); // 성공 → 2.1 아이 프로필 선택 (1.1.2 화면 이동)
}
