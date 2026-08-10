// 브라우저용 Supabase 클라이언트 (T010) — Auth 세션 쿠키 관리는 @supabase/ssr가 담당.
// publishable 키만 사용(브라우저 노출 전제) — service role 키는 절대 여기로 오면 안 된다(FR-019).
import { createBrowserClient } from '@supabase/ssr';

export function getSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
