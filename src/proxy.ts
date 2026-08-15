// Auth 세션 갱신·보호 라우트 (T010, R-10)
// Next 16.3: middleware.ts는 deprecated — proxy.ts로 개명됨 (기능 동일, Node 런타임 기본).
// 문서: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/** 로그인 없이 접근 불가한 페이지 프리픽스 — 미인증 시 /login으로 리다이렉트 */
const PROTECTED_PREFIXES = ['/home', '/profiles', '/stories', '/play', '/complete', '/my', '/wordbook'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // 토큰 만료 시 세션 갱신까지 수행하므로 반드시 호출한다 (@supabase/ssr 요구사항)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // API 인증 판정은 각 Route Handler 책임(401 JSON — contracts/api-routes.md 공통 규약).
  // 여기서는 세션 쿠키 갱신만 통과시킨다.
  return response;
}

export const config = {
  // 정적 파일·이미지 최적화·파비콘 제외 전 경로 — /api 포함(세션 갱신 목적)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)'],
};
