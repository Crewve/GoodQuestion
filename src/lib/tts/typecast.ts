// 타입캐스트 TTS 어댑터 (T016) — provider 인터페이스로 감싸 벤더 교체 여지 유지 (R-05).
// API 스펙 실측 확인 (2026-08-10, 파트1 계획 §5 리스크 해소):
//   GET  https://api.typecast.ai/v1/voices            → [{ voice_id, voice_name, model, emotions, voice_type }]
//   POST https://api.typecast.ai/v1/text-to-speech    → audio/mpeg (mp3, 320kbps)
//     headers: X-API-KEY / body: { voice_id, text, model, prompt?: { emotion_preset }, output?: { audio_format } }
// 무료 플랜: 월 3만 자·동시 호출 2·출처 표기 의무 — 동시성 2 제한 큐 내장.
import type { SynthesizeFn } from '../contracts';

if (typeof window !== 'undefined') {
  throw new Error('src/lib/tts/typecast.ts는 서버 전용입니다 — 클라이언트 컴포넌트에서 임포트하지 마세요.');
}

export type TypecastVoice = {
  voice_id: string;
  voice_name: string;
  model: string;
  emotions: string[];
  voice_type: string;
};

export type SynthesizeOpts = {
  /** 보이스의 모델명 — 생략 시 /v1/voices 조회로 자동 해석 (voice-map 확정 후에는 명시 권장) */
  model?: string;
  /** emotion_preset — 보이스별 emotions 목록 내 값. 기본 normal */
  emotion?: string;
};

const API_BASE = 'https://api.typecast.ai/v1';
const MAX_CONCURRENT = 2; // 무료 플랜 동시 호출 한도 — 배치 생성 시 특히 중요

function apiKey(): string {
  const key = process.env.TYPECAST_API_KEY;
  if (!key) throw new Error('TYPECAST_API_KEY가 설정되지 않았습니다 (.env.local 확인).');
  return key;
}

// 동시성 2 세마포어 — 호출부가 아니라 어댑터에 내장해 모든 경로에서 한도를 지킨다
let active = 0;
const waiters: Array<() => void> = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    waiters.shift()?.();
  }
}

let voicesCache: TypecastVoice[] | null = null;

/** 보이스 목록 조회 (프로세스 내 캐시) — 후보 선정·model 해석용 */
export async function listVoices(): Promise<TypecastVoice[]> {
  if (voicesCache) return voicesCache;
  const res = await fetch(`${API_BASE}/voices`, { headers: { 'X-API-KEY': apiKey() } });
  if (!res.ok) throw new Error(`타입캐스트 보이스 목록 조회 실패: HTTP ${res.status}`);
  voicesCache = (await res.json()) as TypecastVoice[];
  return voicesCache;
}

async function resolveModel(voiceId: string): Promise<string> {
  const voice = (await listVoices()).find((v) => v.voice_id === voiceId);
  if (!voice) throw new Error(`알 수 없는 voice_id: ${voiceId}`);
  return voice.model;
}

/** 텍스트 → mp3 Buffer. 계약(contracts.ts SynthesizeFn)의 구현체 — CLOSING에는 호출 금지(사전 생성 재생). */
export async function synthesize(text: string, voiceId: string, opts: SynthesizeOpts = {}): Promise<Buffer> {
  const model = opts.model ?? (await resolveModel(voiceId));
  return withSlot(async () => {
    const res = await fetch(`${API_BASE}/text-to-speech`, {
      method: 'POST',
      headers: { 'X-API-KEY': apiKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice_id: voiceId,
        text,
        model,
        prompt: { emotion_preset: opts.emotion ?? 'normal' },
        output: { audio_format: 'mp3' },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`타입캐스트 합성 실패: HTTP ${res.status} ${detail.slice(0, 200)}`);
    }
    return Buffer.from(await res.arrayBuffer());
  });
}

// 벤더 중립 provider 표면 — 교체 시 이 형태만 유지하면 된다
export type TtsProvider = {
  synthesize: (text: string, voiceId: string, opts?: SynthesizeOpts) => Promise<Buffer>;
  listVoices: () => Promise<TypecastVoice[]>;
};

export const typecastProvider: TtsProvider = { synthesize, listVoices };

// 계약 타입 준수 확인용 (파트2 → 파트1 접점 ②)
export const synthesizeFn: SynthesizeFn = (text, voiceId) => synthesize(text, voiceId);
