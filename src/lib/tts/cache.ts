// TTS 2층 캐시 (T017) — hash(voiceId+text) 키 (R-05, Decision Log 다시 듣기 요건).
//   1층: 로컬 디렉토리 (CLI/배치 — 재실행 시 과금 방지)
//   2층: Supabase Storage `tts-cache` 버킷 (런타임 — 재생 URL 공개 읽기)
// Storage 클라이언트는 주입받는다 — CLI는 scripts/lib/supabase(ws transport), 서버는 @/lib/supabase.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'tts-cache';

/** 캐시 키 — 같은 캐릭터(voice)의 같은 대사는 항상 같은 파일 */
export function cacheKey(voiceId: string, text: string): string {
  return `${createHash('sha256').update(`${voiceId}\0${text}`).digest('hex')}.mp3`;
}

export function readLocal(dir: string, key: string): Buffer | null {
  const path = join(dir, key);
  return existsSync(path) ? readFileSync(path) : null;
}

export function writeLocal(dir: string, key: string, mp3: Buffer): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, key), mp3);
}

export async function readStorage(client: SupabaseClient, key: string): Promise<Buffer | null> {
  const { data, error } = await client.storage.from(BUCKET).download(key);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function writeStorage(client: SupabaseClient, key: string, mp3: Buffer): Promise<void> {
  const { error } = await client.storage
    .from(BUCKET)
    .upload(key, mp3, { contentType: 'audio/mpeg', upsert: true });
  if (error) throw new Error(`tts-cache 업로드 실패(${key}): ${error.message}`);
}

/** 런타임 재생용 공개 URL */
export function storageUrl(client: SupabaseClient, key: string): string {
  return client.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
}

/** 버킷에 객체가 없으면 업로드 — 로컬 캐시 히트 시에도 반환 URL이 항상 유효하도록 보장 */
export async function ensureStorage(client: SupabaseClient, key: string, mp3: Buffer): Promise<void> {
  try {
    const { data: exists } = await client.storage.from(BUCKET).exists(key);
    if (exists) return;
  } catch {
    // exists 미지원 버전 등 — 업로드(upsert)로 폴백
  }
  await writeStorage(client, key, mp3);
}
