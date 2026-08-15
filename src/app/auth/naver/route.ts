// 네이버 로그인 시작 (T082, 기능명세서 1.1.2) — Supabase Auth가 네이버를 지원하지 않아
// 자체 인가 코드 플로우를 쓴다. 여기서 CSRF 방지용 state를 쿠키에 심고 네이버 동의 화면으로
// 보내면, 등록된 Callback URL(/auth/naver/callback)에서 토큰 교환·세션 발급을 마친다.
import { randomBytes } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import {
  NAVER_COOKIE_PATH,
  NAVER_STATE_COOKIE,
  buildAuthorizeUrl,
  encodeStateCookie,
  getNaverEnv,
  safeNext,
} from '@/lib/auth/naver';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const env = getNaverEnv();
  // 키 미설정 — 로그인 화면은 이때 버튼을 준비 중 안내로 대체하므로 직접 URL 진입만 해당
  if (!env) return NextResponse.redirect(new URL('/login?error=social', url.origin));

  const state = randomBytes(16).toString('hex');
  const next = safeNext(url.searchParams.get('next'));
  const response = NextResponse.redirect(buildAuthorizeUrl(env.clientId, url.origin, state));
  // sameSite lax — 네이버에서 돌아오는 최상위 GET 내비게이션에도 쿠키가 실린다
  response.cookies.set(NAVER_STATE_COOKIE, encodeStateCookie(state, next), {
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    path: NAVER_COOKIE_PATH,
    maxAge: 60 * 10,
  });
  return response;
}
