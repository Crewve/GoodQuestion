// 소셜 로그인(카카오) PKCE 콜백 (T044, R-10) — Supabase가 ?code=로 되돌려주면 세션 쿠키로 교환한다.
// 보호 경로(/profiles 등)로 직접 redirectTo를 주면 proxy가 미인증 상태에서 /login으로 돌려보내
// code가 유실되므로, 공개 경로인 여기서 교환을 마친 뒤 next로 이동한다.
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';

/** 오픈 리다이렉트 방지 — 내부 경로만 허용 */
function safeNext(next: string | null): string {
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/profiles';
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (code) {
    const supabase = await getSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  // code 부재(사용자 취소 등)·교환 실패 — 로그인 화면에서 소셜 실패 문구 노출 (기능명세서 1.1)
  return NextResponse.redirect(new URL('/login?error=social', url.origin));
}
