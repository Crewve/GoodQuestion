import { describe, expect, it } from "vitest";
import { sttGate } from "../config";
import { runSttGates, type SttGateConfig, type WhisperSegment } from "./gates";

// 기본 설정은 파트2 config.ts의 실제 기본값 사용 — 통합 정합도 함께 검증
const config: SttGateConfig = sttGate;

const goodSegments: WhisperSegment[] = [
  { start: 0, end: 2.5, avg_logprob: -0.25, no_speech_prob: 0.05 },
  { start: 2.5, end: 4.0, avg_logprob: -0.3, no_speech_prob: 0.1 },
];

describe("runSttGates — 통과 케이스", () => {
  it("정상 발화는 통과한다", () => {
    const result = runSttGates(
      { text: "며느리가 방귀를 참아서 배가 아팠을 것 같아요", segments: goodSegments },
      config,
    );
    expect(result.failed).toBe(false);
    expect(result.reason).toBeNull();
  });

  it("segments가 없으면 확률 게이트는 판정 보류하고 텍스트 게이트만 적용한다", () => {
    const result = runSttGates({ text: "며느리를 도와주고 싶어요" }, config);
    expect(result.failed).toBe(false);
    expect(result.signals.noSpeechProb).toBeNull();
    expect(result.signals.avgLogprob).toBeNull();
  });
});

describe("runSttGates — 게이트 ①~⑤", () => {
  it("① 공백 제거 후 1~2자는 TOO_SHORT", () => {
    expect(runSttGates({ text: "네", segments: goodSegments }, config).reason).toBe("TOO_SHORT");
    expect(runSttGates({ text: "아 네 ", segments: goodSegments }, config).reason).toBe("TOO_SHORT");
    expect(runSttGates({ text: "몰라요", segments: goodSegments }, config).failed).toBe(false);
  });

  it("② no_speech_prob 초과는 NO_SPEECH", () => {
    const result = runSttGates(
      { text: "이상한 소리가 들려요", segments: [{ start: 0, end: 3, avg_logprob: -0.3, no_speech_prob: 0.9 }] },
      config,
    );
    expect(result.reason).toBe("NO_SPEECH");
  });

  it("③ avg_logprob 미달은 LOW_CONFIDENCE", () => {
    const result = runSttGates(
      { text: "무슨 말인지 알 수 없는 소리", segments: [{ start: 0, end: 3, avg_logprob: -1.6, no_speech_prob: 0.2 }] },
      config,
    );
    expect(result.reason).toBe("LOW_CONFIDENCE");
  });

  it("④ 같은 구절 반복은 NGRAM_REPEAT", () => {
    const result = runSttGates(
      { text: "바나나 좋아 바나나 좋아 바나나 좋아 바나나 좋아 바나나 좋아", segments: goodSegments },
      config,
    );
    expect(result.reason).toBe("NGRAM_REPEAT");
    expect(result.signals.maxNgramRepeat).toBeGreaterThan(config.ngramMaxRepeats);
  });

  it("⑤ 자막체 상투구는 띄어쓰기가 달라도 HALLUCINATION_PHRASE", () => {
    const result = runSttGates(
      { text: "시청해  주셔서   감사합니다", segments: goodSegments },
      config,
    );
    expect(result.reason).toBe("HALLUCINATION_PHRASE");
    expect(result.signals.matchedPhrase).not.toBeNull();
  });

  it("⑤ 구독·알림 설정 유도 변형도 HALLUCINATION_PHRASE (실측 환각 2026-08-13)", () => {
    const result = runSttGates(
      { text: "구독, 좋아요, 알림 설정 부탁드립니다!", segments: goodSegments },
      config,
    );
    expect(result.reason).toBe("HALLUCINATION_PHRASE");
  });
});

describe("runSttGates — ⑥ 힌트 echo", () => {
  // buildSttHint 산출물 형태 재현 — [직전 대사, 캐릭터명들, 주제, 제목] 결합
  const hint =
    "친구야, 내 방귀가 너무 크다는 걸 알면 가족들이 나를 이상하게 생각하지 않을까?, 며느리, 시아버지, 이장님, 다름, 자기이해, 방귀 뀌는 며느리";

  it("무의미 발화에서 힌트의 제목을 그대로 받아쓴 전사는 HINT_ECHO", () => {
    const result = runSttGates({ text: "방귀 뀌는 며느리", segments: goodSegments, hint }, config);
    expect(result.reason).toBe("HINT_ECHO");
    expect(result.signals.hintEcho).toBe(true);
  });

  it("하한(hintEchoMinChars) 미만의 짧은 정상 한 단어 답변은 보호한다", () => {
    const result = runSttGates({ text: "며느리", segments: goodSegments, hint }, config);
    expect(result.failed).toBe(false);
  });

  it("힌트 어휘를 포함해도 전사에 새 내용이 있으면 통과한다", () => {
    const result = runSttGates(
      { text: "방귀 뀌는 며느리가 부끄러웠을 것 같아요", segments: goodSegments, hint },
      config,
    );
    expect(result.failed).toBe(false);
  });

  it("hint 미전달이면 ⑥은 판정 보류한다", () => {
    const result = runSttGates({ text: "방귀 뀌는 며느리", segments: goodSegments }, config);
    expect(result.failed).toBe(false);
  });
});

describe("runSttGates — 순서·설정 주입", () => {
  it("여러 게이트에 동시에 걸리면 앞선 게이트의 reason이 우선한다 (① > ②)", () => {
    const result = runSttGates(
      { text: "네", segments: [{ start: 0, end: 1, no_speech_prob: 0.95, avg_logprob: -2 }] },
      config,
    );
    expect(result.reason).toBe("TOO_SHORT");
  });

  it("가중 평균: 긴 무음 구간이 짧은 정상 구간보다 크게 반영된다", () => {
    const result = runSttGates(
      {
        text: "조용한 방에서 말했어요",
        segments: [
          { start: 0, end: 9, no_speech_prob: 0.8, avg_logprob: -0.4 }, // 9초 무음성
          { start: 9, end: 10, no_speech_prob: 0.1, avg_logprob: -0.2 }, // 1초 정상
        ],
      },
      config,
    );
    expect(result.reason).toBe("NO_SPEECH"); // 가중 평균 0.73 > 0.6
  });

  it("임계값은 주입된 설정을 따른다 (튜닝 가능 — T022)", () => {
    const loose: SttGateConfig = { ...config, noSpeechProbMax: 0.99 };
    const result = runSttGates(
      { text: "설정을 바꾸면 통과해요", segments: [{ start: 0, end: 3, no_speech_prob: 0.9, avg_logprob: -0.3 }] },
      loose,
    );
    expect(result.failed).toBe(false);
  });
});
