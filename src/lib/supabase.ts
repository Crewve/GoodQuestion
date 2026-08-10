// 서버 전용 Supabase service role 클라이언트 (T004) — RLS 우회 관리자 권한.
// openai.ts와 같은 이유로 `server-only` 대신 런타임 가드 사용 (tsx CLI 호환).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

if (typeof window !== 'undefined') {
  throw new Error('src/lib/supabase.ts는 서버 전용입니다 — 클라이언트 컴포넌트에서 임포트하지 마세요.');
}

let admin: SupabaseClient | null = null;

/** 지연 초기화 service role 클라이언트 — 세션 미보존(서버/CLI 1회성 호출용). */
export function getSupabaseAdmin(): SupabaseClient {
  if (!admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error(
        'NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다 (.env.local 확인).',
      );
    }
    admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
