// 설정 로더 — 역할별 모델명(R-01)·STT 실패 게이트 임계값(R-02)을 env/기본값으로 분리.
// 임계값은 재배포 없이 env로 튜닝 가능해야 한다(quickstart §5 체크리스트).
// CLI(tsx) 실행 시에는 Node 20의 `--env-file=.env.local`로 env를 주입한다.

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** 역할별 모델 — env로 개별 상향 가능, 기본 gpt-4o-mini (R-01) */
export const models = {
  whisper: 'whisper-1',
  sttCorrection: process.env.STT_CORRECTION_MODEL || 'gpt-4o-mini',
  analysis: process.env.ANALYSIS_MODEL || 'gpt-4o-mini',
  generation: process.env.GENERATION_MODEL || 'gpt-4o-mini',
};

/**
 * STT 실패 게이트 임계값 (R-02 — 판정 순서: ①최소 글자 ②no_speech_prob ③avg_logprob ④n-gram 반복 ⑤자막체 상투구)
 * 소비자는 파트1 `src/lib/stt/gates.ts`(순수 함수, config 주입).
 * ⚠️ 기본값·항목 구성은 파트1과 합의 대상(T003) — 실측 튜닝(T022)은 파트1 담당.
 */
export const sttGate = {
  /** ① 공백 제거 후 글자 수가 이 값 이하면 실패 (기본: 1~2자 차단) */
  maxTrivialChars: envNumber('STT_GATE_MAX_TRIVIAL_CHARS', 2),
  /** ② Whisper no_speech_prob가 이 값을 초과하면 실패 */
  noSpeechProbMax: envNumber('STT_GATE_NO_SPEECH_PROB', 0.6),
  /** ③ Whisper avg_logprob가 이 값 미만이면 실패 */
  avgLogprobMin: envNumber('STT_GATE_AVG_LOGPROB', -1.0),
  /** ④ 동일 n-gram(어절 단위)이 이 횟수 초과 반복되면 환각 판정 */
  ngramSize: envNumber('STT_GATE_NGRAM_SIZE', 2),
  ngramMaxRepeats: envNumber('STT_GATE_NGRAM_MAX_REPEATS', 3),
  /** ⑤ 자막체 상투구 — Whisper 한국어 무음 환각 빈출 문구, 포함 시 실패 (파트1 튜닝 대상) */
  hallucinationPhrases: [
    '시청해 주셔서 감사합니다',
    '시청해주셔서 감사합니다',
    '구독과 좋아요',
    '구독 눌러',
    '좋아요와 구독',
    '다음 영상에서 만나요',
    '영상이 도움이 되셨다면',
    '자막 제공',
    '한글자막',
    'MBC 뉴스',
    'KBS 뉴스',
    'SBS 뉴스',
  ],
};

/** Whisper prompt 힌트 최대 토큰 (R-01 — 장면별 힌팅 상한) */
export const sttHintMaxTokens = 224;

/**
 * 규칙 엔진 GUIDED 전환 임계 (FR-010) — 소비자는 src/lib/rules/engine.ts(순수 함수, 주입).
 * 기본 1: 새 요소 없는 턴·저정보 발화가 1턴만 이어져도 다음 응답에서 부족 요소를 유도한다
 * (max_turns 4~5로 짧아 이른 유도가 목표 충족에 유리).
 */
export const rules = {
  guidedStagnantTurns: envNumber('RULES_GUIDED_STAGNANT_TURNS', 1),
  guidedLowInfoTurns: envNumber('RULES_GUIDED_LOW_INFO_TURNS', 1),
};
