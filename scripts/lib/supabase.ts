import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import ws from "ws";
import { loadEnvLocal, requireEnv } from "./env";

/**
 * CLI 스크립트용 service role 클라이언트.
 * Node 20에는 네이티브 WebSocket이 없어 supabase-js(v2.109+)가 생성자에서 실패한다
 * — realtime은 미사용이지만 transport 주입으로 우회 (Node 22 업그레이드 시 제거 가능).
 * 주의: 서버 런타임용 클라이언트(src/lib/supabase.ts, 파트2 T004)도 동일 이슈 대상.
 */
export function createServiceClient(): SupabaseClient {
  loadEnvLocal();
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: ws as unknown as WebSocket },
    },
  );
}
