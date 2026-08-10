// TTS 진입점 (T017) — 캐시 조회 → 미스 시 합성 → 캐시 기록.
// 파트2(/api/turn ⑦)는 이 모듈만 임포트한다 (typecast.ts 직접 호출 금지 — 벤더 교체 여지).
import type { SupabaseClient } from '@supabase/supabase-js';
import { cacheKey, ensureStorage, readLocal, readStorage, storageUrl, writeLocal, writeStorage } from './cache';
import { synthesize, type SynthesizeOpts } from './typecast';

export { cacheKey, storageUrl };
export { listVoices, synthesize, typecastProvider } from './typecast';

export type CachedSynthesisResult = {
  buffer: Buffer;
  key: string;
  /** local/storage = 캐시 히트 (과금 0), api = 신규 합성 */
  source: 'local' | 'storage' | 'api';
  /** storage 캐시가 관여한 경우 재생용 공개 URL */
  url?: string;
};

export type CacheOpts = SynthesizeOpts & {
  /** 1층 로컬 캐시 디렉토리 (CLI/배치). 기본 .tts-cache */
  localDir?: string;
  /** 2층 Storage 캐시 클라이언트 (런타임). 주입 필수 — 파트2는 @/lib/supabase, CLI는 scripts/lib/supabase */
  storage?: SupabaseClient;
};

export async function synthesizeWithCache(
  text: string,
  voiceId: string,
  opts: CacheOpts = {},
): Promise<CachedSynthesisResult> {
  const key = cacheKey(voiceId, text);
  const localDir = opts.localDir ?? '.tts-cache';

  const local = readLocal(localDir, key);
  if (local) {
    let url: string | undefined;
    if (opts.storage) {
      await ensureStorage(opts.storage, key, local); // URL을 반환하는 이상 객체 존재를 보장
      url = storageUrl(opts.storage, key);
    }
    return { buffer: local, key, source: 'local', url };
  }

  if (opts.storage) {
    const remote = await readStorage(opts.storage, key);
    if (remote) {
      writeLocal(localDir, key, remote); // 로컬로 승격 — 다음 조회는 디스크
      return { buffer: remote, key, source: 'storage', url: storageUrl(opts.storage, key) };
    }
  }

  const mp3 = await synthesize(text, voiceId, { model: opts.model, emotion: opts.emotion });
  writeLocal(localDir, key, mp3);
  let url: string | undefined;
  if (opts.storage) {
    await writeStorage(opts.storage, key, mp3);
    url = storageUrl(opts.storage, key);
  }
  return { buffer: mp3, key, source: 'api', url };
}
