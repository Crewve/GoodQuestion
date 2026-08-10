// Route Handler/Server Component용 인증 인지 Supabase 클라이언트 (T010/T031)
// 쿠키의 Auth 세션을 읽어 "지금 로그인한 보호자"를 판별한다. DB 쓰기는 supabase.ts(admin) 사용.
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getSupabaseServer() {
  const cookieStore = await cookies(); // Next 15+: cookies()는 async
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서 호출된 경우 쿠키 쓰기가 불가 — 세션 갱신은 proxy.ts가 담당
          }
        },
      },
    },
  );
}

/** 로그인한 사용자를 반환, 미인증이면 null */
export async function getAuthedUser() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
