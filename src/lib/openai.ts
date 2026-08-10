// OpenAI 단일 클라이언트 (T004) — 서버·CLI 전용.
// `server-only` 패키지는 tsx CLI(simulate/seed 등)에서 임포트 즉시 throw하므로 쓰지 않고,
// 동일 목적(클라이언트 번들 유입 차단)을 런타임 가드로 달성한다. 번들 검증은 T063(next build 후 키 검색).
import OpenAI from 'openai';

if (typeof window !== 'undefined') {
  throw new Error('src/lib/openai.ts는 서버 전용입니다 — 클라이언트 컴포넌트에서 임포트하지 마세요.');
}

let client: OpenAI | null = null;

/** 지연 초기화 — next build 시 env 부재로 모듈 평가가 깨지지 않게 한다. */
export function getOpenAI(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY가 설정되지 않았습니다 (.env.local 확인).');
    }
    client = new OpenAI(); // OPENAI_API_KEY는 SDK가 env에서 읽음
  }
  return client;
}
