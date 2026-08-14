// STT 진입점 (T015) — Whisper(verbose_json) → 실패 게이트(T012) → gpt-4o-mini 경량 교정 → SttResult (R-02).
// 파트2(/api/turn)는 contracts.ts의 SttResult 3필드만 본다. 게이트 신호는 stt-check CLI 튜닝(T022)용 부가 정보.
// 오디오는 메모리에서 OpenAI로 스트리밍한 뒤 즉시 폐기 — 이 모듈은 디스크·DB에 아무것도 쓰지 않는다.
// Whisper 호출 자체가 실패하면 throw — 폴백(failed:true 200)은 호출자(라우트/CLI) 책임 (api-routes.md 폴백 매트릭스).
import type { Uploadable } from 'openai';
import { getOpenAI } from '../openai';
import { models, sttGate } from '../config';
import type { SttResult } from '../contracts';
import { runSttGates, type SttGateResult, type WhisperSegment } from './gates';

export { buildSttHint } from './hints';

const WHISPER_TIMEOUT_MS = 30_000; // 녹음 상한 30초(T034) 기준 — 초과 시 throw, 라우트가 failed:true로 변환
const CORRECTION_TIMEOUT_MS = 10_000;

export type SpeechToTextOptions = {
  /** Whisper prompt 힌트 — buildSttHint(장면, 직전 캐릭터 대사) 산출물 (≤224토큰) */
  hint?: string;
};

export type SpeechToTextResult = SttResult & {
  /** 게이트 판정 상세 — 임계 튜닝·디버깅용 (API 응답에는 포함하지 않는다) */
  gate: SttGateResult;
  /** 교정 LLM이 실제 반영됐는지 — false면 폴백(원문 유지) 또는 게이트 실패로 미시도 */
  corrected: boolean;
  durationSec: number | null;
  language: string | null;
};

export async function speechToText(
  audio: Uploadable,
  opts: SpeechToTextOptions = {},
): Promise<SpeechToTextResult> {
  const transcription = await getOpenAI().audio.transcriptions.create(
    {
      file: audio,
      model: models.whisper,
      language: 'ko',
      response_format: 'verbose_json',
      prompt: opts.hint || undefined,
      temperature: 0,
    },
    { timeout: WHISPER_TIMEOUT_MS },
  );

  const sttRawText = transcription.text.trim();
  const gate = runSttGates(
    // hint 동봉 — 무의미 발화에서 힌트(제목·대사)를 그대로 받아쓰는 환각을 ⑥ echo 게이트가 차단
    { text: sttRawText, segments: transcription.segments as WhisperSegment[] | undefined, hint: opts.hint },
    sttGate,
  );
  const durationSec = transcription.duration ?? null;
  const language = transcription.language ?? null;

  // 게이트 실패 = 재녹음 유도 분기 — 교정 호출 비용을 쓰지 않는다 (failed:true는 메시지 미생성, 계약 불변 조건 1)
  if (gate.failed) {
    return { text: sttRawText, sttRawText, failed: true, gate, corrected: false, durationSec, language };
  }

  const { text, corrected } = await correctTranscript(sttRawText);
  return { text, sttRawText, failed: false, gate, corrected, durationSec, language };
}

const CORRECTION_SYSTEM =
  '아동의 한국어 발화 전사를 받아 맞춤법·띄어쓰기·조사만 교정한다. ' +
  '단어 선택·어순·의미는 절대 바꾸지 않고, 없는 말을 추가하지 않는다. ' +
  '설명이나 따옴표 없이 교정된 문장만 출력한다.';

/** 경량 교정 — 어떤 실패(API 오류·빈 출력·과도한 변형)든 원문 폴백으로 흡수한다 (R-02) */
async function correctTranscript(raw: string): Promise<{ text: string; corrected: boolean }> {
  try {
    const completion = await getOpenAI().chat.completions.create(
      {
        model: models.sttCorrection,
        temperature: 0,
        messages: [
          { role: 'system', content: CORRECTION_SYSTEM },
          { role: 'user', content: raw },
        ],
      },
      { timeout: CORRECTION_TIMEOUT_MS },
    );
    const out = (completion.choices[0]?.message?.content ?? '').trim().replace(/^["'“”]+|["'“”]+$/g, '');
    // 표기 교정은 길이가 크게 달라질 수 없다 — 크게 다르면 의미 변경으로 보고 원문 유지
    if (!out || out.length > raw.length * 2 + 10 || (out.length * 2) + 10 < raw.length) {
      return { text: raw, corrected: false };
    }
    return { text: out, corrected: out !== raw };
  } catch {
    return { text: raw, corrected: false };
  }
}
