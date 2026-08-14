'use client';
// 녹음 훅 (T034, R-15) — MediaRecorder 기반. iPad Safari=audio/mp4, 안드로이드/데스크톱 Chrome=audio/webm;codecs=opus
// (/api/stt가 두 포맷 모두 수용). 30초 자동 종료, AnalyserNode로 실시간 레벨(RMS) 측정,
// 종료 시 사전 게이트(최소 길이·RMS 무음)를 순수 함수로 판정해 서버 왕복 전에 무효 녹음을 거른다.
// 상태 전이는 턴 상태머신(src/store/turn.ts, 파트2 T033) 몫 — 이 훅은 녹음 장치만 다룬다.
import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderPrecheckReason = 'TOO_SHORT' | 'TOO_QUIET';
export type RecorderPrecheck = { ok: boolean; reason: RecorderPrecheckReason | null };

export type RecordingResult = {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  /** 녹음 전 구간 평균 RMS (0~1) */
  rms: number;
  precheck: RecorderPrecheck;
};

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'error';

export const RECORDER_DEFAULTS = {
  /** 이 미만이면 TOO_SHORT — 실수 탭 수준의 초단 녹음 차단 */
  minDurationMs: 600,
  /** 평균 RMS가 이 미만이면 TOO_QUIET — 무음 녹음의 서버 왕복(Whisper 과금·환각) 방지 */
  minRms: 0.01,
  /** 녹음 상한 — 도달 시 자동 종료 (기능명세서 2.4.3) */
  maxDurationMs: 30_000,
};

/** 사전 게이트 순수 함수 — 서버 게이트 5종(gates.ts)의 앞단. 임계는 T022 실측과 함께 조정. */
export function precheckRecording(
  durationMs: number,
  rms: number,
  cfg: { minDurationMs: number; minRms: number } = RECORDER_DEFAULTS,
): RecorderPrecheck {
  if (durationMs < cfg.minDurationMs) return { ok: false, reason: 'TOO_SHORT' };
  if (rms < cfg.minRms) return { ok: false, reason: 'TOO_QUIET' };
  return { ok: true, reason: null };
}

/** 지원 mime 협상 — Safari는 webm 미지원이라 mp4로 폴백 */
export function pickRecorderMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return ''; // 브라우저 기본에 위임
}

export type UseRecorderOptions = {
  maxDurationMs?: number;
  /** 녹음 종료(수동·30초 자동 공통) 시 1회 호출 — 사전 게이트 결과 포함 */
  onComplete?: (result: RecordingResult) => void;
};

export function useRecorder(options: UseRecorderOptions = {}) {
  const { maxDurationMs = RECORDER_DEFAULTS.maxDurationMs, onComplete } = options;
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [level, setLevel] = useState(0); // 실시간 RMS (마이크 버튼 펄스 등 UI용)
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rmsSumRef = useRef(0);
  const rmsCountRef = useRef(0);
  const startedAtRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete; // 최신 콜백 유지 — 렌더 중 ref 쓰기 금지(react-hooks/refs)
  });

  const cleanup = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    recorderRef.current = null;
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]); // 언마운트 시 마이크 해제

  const start = useCallback(async () => {
    if (recorderRef.current) return; // 이미 녹음 중
    setError(null);
    setStatus('requesting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatus('error');
      setError('마이크 접근 권한이 필요해요'); // 기능명세서 2.4.3 예외 원문 (대화·미션 공용, 2.4.5는 retelling 자체 문구)
      return;
    }
    streamRef.current = stream;

    // RMS 측정 — AnalyserNode 시간 영역 샘플로 프레임마다 계산, 전 구간 평균을 사전 게이트에 사용
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const tick = () => {
        if (!recorderRef.current) return;
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i += 1) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        rmsSumRef.current += rms;
        rmsCountRef.current += 1;
        setLevel(rms);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // 분석기 실패 시 레벨 없이 진행 — rms=0이면 사전 게이트 TOO_QUIET로 걸리므로 카운트를 남기지 않는다
    }

    const mimeType = pickRecorderMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    recorderRef.current = recorder;
    chunksRef.current = [];
    rmsSumRef.current = 0;
    rmsCountRef.current = 0;
    startedAtRef.current = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const durationMs = Date.now() - startedAtRef.current;
      // 분석기가 아예 못 돈 환경(측정 0회)은 RMS 게이트를 통과 처리 — 서버 게이트가 최종 방어선
      const rms = rmsCountRef.current > 0 ? rmsSumRef.current / rmsCountRef.current : RECORDER_DEFAULTS.minRms;
      const type = recorder.mimeType || mimeType || 'audio/webm';
      const result: RecordingResult = {
        blob: new Blob(chunksRef.current, { type }),
        mimeType: type,
        durationMs,
        rms,
        precheck: precheckRecording(durationMs, rms),
      };
      cleanup();
      setStatus('idle');
      onCompleteRef.current?.(result);
    };

    recorder.start();
    setStatus('recording');
    timeoutRef.current = setTimeout(() => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    }, maxDurationMs);
  }, [cleanup, maxDurationMs]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }, []);

  /** 결과를 버리고 종료 — onComplete 미호출 (나가기 등) */
  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null; // onstop 결과 경로 차단
    if (recorder && recorder.state === 'recording') {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    setStatus('idle');
  }, [cleanup]);

  return { status, level, error, start, stop, cancel, isRecording: status === 'recording' };
}
