// TTS 진입점 (T017) — 캐시 조회 → 미스 시 합성 → 캐시 기록.
// 파트2(/api/turn ⑦)는 이 모듈만 임포트한다 (typecast.ts 직접 호출 금지 — 벤더 교체 여지).
import type { SupabaseClient } from '@supabase/supabase-js';
import { cacheKey, ensureStorage, readLocal, readStorage, storageUrl, writeLocal, writeStorage } from './cache';
import { synthesize, type SynthesizeOpts } from './typecast';
import voiceMap from './voice-map.json';

export { cacheKey, storageUrl };
export { listVoices, synthesize, typecastProvider } from './typecast';

export type VoiceMapping = { voice_name: string; voice_id: string; model: string };

/** T019 확정 보이스 — role은 fixtures/tts-lines의 voice_role (캐릭터 external_id 또는 'narrator') */
export function voiceForRole(role: string): VoiceMapping {
  const entry = (voiceMap as Record<string, VoiceMapping | string>)[role];
  if (!entry || typeof entry === 'string') {
    throw new Error(`voice-map.json에 없는 voice_role: ${role}`);
  }
  return entry;
}

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

/**
 * 로컬 1층 캐시 쓰기는 best-effort — 서버리스(Vercel)는 배포 디렉토리가 read-only(EROFS)라
 * 쓰기 실패가 정상 경로다. 여기서 throw하면 합성이 성공했는데도 audioUrl=null로 무음이 되고
 * 타입캐스트 과금만 남는다 (2026-08-14 스테이징 무음 원인). Storage 2층이 런타임 캐시의 SoT.
 */
function tryWriteLocal(dir: string, key: string, mp3: Buffer): void {
  try {
    writeLocal(dir, key, mp3);
  } catch (error) {
    console.warn(`[tts] 로컬 캐시 쓰기 생략(${key}): ${error instanceof Error ? error.message : error}`);
  }
}

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
      tryWriteLocal(localDir, key, remote); // 로컬로 승격 — 다음 조회는 디스크
      return { buffer: remote, key, source: 'storage', url: storageUrl(opts.storage, key) };
    }
  }

  const mp3 = await synthesize(text, voiceId, { model: opts.model, emotion: opts.emotion });
  tryWriteLocal(localDir, key, mp3);
  let url: string | undefined;
  if (opts.storage) {
    await writeStorage(opts.storage, key, mp3);
    url = storageUrl(opts.storage, key);
  }
  return { buffer: mp3, key, source: 'api', url };
}
