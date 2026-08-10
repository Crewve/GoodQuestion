// STT 실패 게이트 (T012) — Whisper 무음 환각·저신뢰 출력 차단. 순수 함수(설정 주입)라 API 없이 단위 테스트 가능 (R-02).
// 판정 순서 고정: ①공백 제거 후 최소 글자 ②no_speech_prob ③avg_logprob ④n-gram 반복 ⑤자막체 상투구.
// 임계값 기본값은 src/lib/config.ts의 sttGate (env로 재배포 없이 튜닝 — T022에서 실측 조정).
// 클라이언트 사전 게이트(RMS·최소 길이)는 useRecorder 몫 — 여기는 서버 측 최종 게이트.

export type SttGateConfig = {
  /** ① 공백 제거 후 글자 수가 이 값 이하면 실패 */
  maxTrivialChars: number;
  /** ② no_speech_prob(구간 가중 평균)가 이 값을 초과하면 실패 */
  noSpeechProbMax: number;
  /** ③ avg_logprob(구간 가중 평균)가 이 값 미만이면 실패 */
  avgLogprobMin: number;
  /** ④ 어절 n-gram 크기와 허용 최대 반복 횟수 */
  ngramSize: number;
  ngramMaxRepeats: number;
  /** ⑤ 포함 시 실패하는 상투구 목록 (공백 무시 비교) */
  hallucinationPhrases: string[];
};

/** Whisper verbose_json의 segment 중 게이트가 쓰는 필드만 */
export type WhisperSegment = {
  text?: string;
  start?: number;
  end?: number;
  avg_logprob?: number;
  no_speech_prob?: number;
};

export type SttGateInput = {
  text: string;
  segments?: WhisperSegment[];
};

export type SttGateReason =
  | "TOO_SHORT"
  | "NO_SPEECH"
  | "LOW_CONFIDENCE"
  | "NGRAM_REPEAT"
  | "HALLUCINATION_PHRASE";

export type SttGateSignals = {
  trimmedLength: number;
  /** 구간 길이 가중 평균 — segments 없으면 null(해당 게이트 통과) */
  noSpeechProb: number | null;
  avgLogprob: number | null;
  maxNgramRepeat: number;
  matchedPhrase: string | null;
};

export type SttGateResult = {
  failed: boolean;
  reason: SttGateReason | null;
  signals: SttGateSignals;
};

/** 구간 길이(end-start) 가중 평균 — 길이 정보가 없으면 동일 가중 */
function weightedMean(segments: WhisperSegment[], pick: (s: WhisperSegment) => number | undefined): number | null {
  let sum = 0;
  let weightSum = 0;
  for (const s of segments) {
    const value = pick(s);
    if (value === undefined) continue;
    const duration = s.end !== undefined && s.start !== undefined ? Math.max(s.end - s.start, 0.01) : 1;
    sum += value * duration;
    weightSum += duration;
  }
  return weightSum > 0 ? sum / weightSum : null;
}

/** 어절 n-gram 최대 반복 횟수 — 같은 구절이 기계적으로 반복되는 환각 패턴 탐지 */
function maxNgramRepeat(text: string, n: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < n) return 0;
  const counts = new Map<string, number>();
  let max = 0;
  for (let i = 0; i + n <= words.length; i += 1) {
    const gram = words.slice(i, i + n).join(" ");
    const count = (counts.get(gram) ?? 0) + 1;
    counts.set(gram, count);
    if (count > max) max = count;
  }
  return max;
}

const stripSpaces = (s: string) => s.replace(/\s+/g, "");

/** 게이트 신호 일괄 수집 — stt-check CLI의 임계 튜닝 출력용으로도 사용 */
export function collectSignals(input: SttGateInput, config: SttGateConfig): SttGateSignals {
  const segments = input.segments ?? [];
  const normalized = stripSpaces(input.text);
  const matchedPhrase =
    config.hallucinationPhrases.find((p) => normalized.includes(stripSpaces(p))) ?? null;
  return {
    trimmedLength: normalized.length,
    noSpeechProb: weightedMean(segments, (s) => s.no_speech_prob),
    avgLogprob: weightedMean(segments, (s) => s.avg_logprob),
    maxNgramRepeat: maxNgramRepeat(input.text, config.ngramSize),
    matchedPhrase,
  };
}

/** 실패 게이트 실행 — 첫 번째로 걸린 게이트의 reason을 반환. failed=true면 메시지 미생성(턴 카운트 제외). */
export function runSttGates(input: SttGateInput, config: SttGateConfig): SttGateResult {
  const signals = collectSignals(input, config);

  let reason: SttGateReason | null = null;
  if (signals.trimmedLength <= config.maxTrivialChars) {
    reason = "TOO_SHORT";
  } else if (signals.noSpeechProb !== null && signals.noSpeechProb > config.noSpeechProbMax) {
    reason = "NO_SPEECH";
  } else if (signals.avgLogprob !== null && signals.avgLogprob < config.avgLogprobMin) {
    reason = "LOW_CONFIDENCE";
  } else if (signals.maxNgramRepeat > config.ngramMaxRepeats) {
    reason = "NGRAM_REPEAT";
  } else if (signals.matchedPhrase !== null) {
    reason = "HALLUCINATION_PHRASE";
  }

  return { failed: reason !== null, reason, signals };
}
