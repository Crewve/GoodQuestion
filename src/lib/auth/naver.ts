// 네이버 로그인 OAuth 헬퍼 (T082, 기능명세서 1.1.2) — Supabase Auth가 네이버 프로바이더를
// 지원하지 않아 자체 인가 코드 플로우로 연동한다: /auth/naver(시작) → nid.naver.com 동의 →
// /auth/naver/callback(토큰 교환·프로필 조회·Supabase 세션 발급). 라우트 핸들러는 HTTP 메서드 외
// export가 제한되므로 두 라우트가 공유하는 상수·순수 함수를 여기에 둔다.

/** state(CSRF 방지)와 복귀 경로를 콜백까지 전달하는 단명 쿠키 — 검증 후 즉시 삭제 */
export const NAVER_STATE_COOKIE = 'naver-oauth-state';
/** 네이버 앱에 등록하는 Callback URL 경로 — 등록값과 정확히 일치해야 한다 */
export const NAVER_CALLBACK_PATH = '/auth/naver/callback';
/** 쿠키 path — 시작·콜백 라우트만 읽으면 되므로 상위 경로로 좁힌다 */
export const NAVER_COOKIE_PATH = '/auth/naver';

export function getNaverEnv(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

/** 오픈 리다이렉트 방지 — 내부 경로만 허용 (auth/callback/route.ts와 동일 규칙) */
export function safeNext(next: string | null | undefined): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/profiles';
}

/** state 쿠키 값 직렬화 — JSON에 쿠키 금지 문자(따옴표·세미콜론 등)가 있어 URL 인코딩한다 */
export function encodeStateCookie(state: string, next: string): string {
  return encodeURIComponent(JSON.stringify({ state, next }));
}

export function parseStateCookie(raw: string | undefined): { state: string; next: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as { state?: unknown; next?: unknown };
    if (typeof parsed.state !== 'string' || parsed.state.length === 0) return null;
    return { state: parsed.state, next: safeNext(typeof parsed.next === 'string' ? parsed.next : null) };
  } catch {
    return null;
  }
}

/** 네이버 인가 페이지 URL — redirect_uri는 네이버 앱에 등록된 Callback URL과 일치해야 한다 */
export function buildAuthorizeUrl(clientId: string, origin: string, state: string): string {
  const url = new URL('https://nid.naver.com/oauth2.0/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', new URL(NAVER_CALLBACK_PATH, origin).toString());
  url.searchParams.set('state', state);
  return url.toString();
}
