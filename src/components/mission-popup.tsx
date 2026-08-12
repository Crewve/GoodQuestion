'use client';
// 미션 오버레이 팝업 (T042, 기능명세서 2.4.3 미션) — 대화 화면 위 단일 오버레이(새 화면 아님, URL·네비게이션 변화 없음).
// 열릴 때부터 닫힐 때까지 하나의 오버레이로 유지되며 내부 콘텐츠만 [미션 진행 중]→[미션 성공 완료]로 전환(진행률 바 없음).
// 캐릭터 음성 재생 없이 화면만 표시하고 아이의 답을 기다린다.
// 마이크는 버튼 시작(자동 아님) — 기능명세서 구성요소 표 기준. 같은 문서의 기능 설명 ⓐ(자동 시작)와 상충하며,
// tasks.md T042가 버튼 시작으로 확정(미션 안내를 읽을 시간이 필요 — 대화 턴의 자동 시작과 구분).
// 노출 판정(T040)·저장/분석(/api/turn isMission, T041)은 파트2 소유 — 이 컴포넌트의 접점은 onSubmit/onContinue 콜백뿐이며
// 상태도 전역 turn 스토어(T033)와 무관한 팝업 로컬 상태만 쓴다(뒤의 대화 턴 사이클을 건드리지 않음).
// 마크업은 피그마 「개발 배포용」 .4.2 대화_미션1/미션2/Mission2Overlay·미션n_성공화면 대조:
// [진행 중] 그라데이션 헤더(미션 칩+안내) → 미션 일러스트(안내 포인트 포함 이미지) → 안내/미리보기 스트립 → 마이크·보내기.
// [성공 완료] 아치형 헤더(🏆·미션 n단계 칩) → 잘했어요! → 성과 문구 → 별 3종 → 배지 카드 → 이야기 계속하기.
import { useCallback, useRef, useState } from 'react';
import { useRecorder, type RecordingResult } from '@/hooks/useRecorder';
import { missionImageUrl } from '@/lib/assets';
import type { SttResult } from '@/lib/contracts';
import { fixedAudioUrl } from '@/lib/fixed-audio';
import story from '../../fixtures/story.banggui.json';

type MissionFixture = {
  title: string;
  scene: string;
  goal: string;
  /** 미션1 — 답에 담을 안내 포인트 목록 */
  guide_points?: string[];
  /** 미션2 — 목적 문장·예시 발화 */
  purpose?: string;
  examples?: string[];
};

const missions = (story as unknown as { missions: Record<string, MissionFixture> }).missions;

/** 시안 헤더 안내 문구 — 미션 오버레이 상단 고정 카피 (개발 배포용) */
const MISSION_HEADLINES: Record<string, string> = {
  mission_1: '며느리의 방귀로 안전하게 배를 떨어뜨릴 방법을 찾아보아요!',
  mission_2: '친구들의 좋은 점을 찾아보아요!',
};

/** 아이 격려 고정 문구 — 시안 하단 스트립 공통 표기 */
const ENCOURAGEMENT = '질문이 많은 친구는 새로운 생각을 찾을 수 있어요.';

/** [미션 성공 완료] 콘텐츠 — 시안 미션1/미션2 성공화면 고정 카피 */
const SUCCESS_CONTENT: Record<
  string,
  { subtitle: string; desc: string; stars: string[]; badgeTitle: string; badgeDesc: string }
> = {
  mission_1: {
    subtitle: '안전하게 배를 떨어뜨릴 방법을 찾았어요',
    desc: '며느리의 방귀를 멋지게 활용하는 아이디어를 냈어요.\n다음 이야기도 함께 떠나볼까요?',
    stars: ['집중력', '창의력', '표현력'],
    badgeTitle: '지혜로운 해결사 배지를 받았어요',
    badgeDesc: '안전하게 문제를 해결하는 특별한 능력이 생겼어요.',
  },
  mission_2: {
    subtitle: '친구들의 좋은 점을 모두 찾았어요',
    desc: '친구들의 특별한 점을 잘 찾아냈어요.\n다음 이야기도 함께 떠나볼까요?',
    stars: ['집중력', '관찰력', '표현력'],
    badgeTitle: '친구 탐정 배지를 받았어요',
    badgeDesc: '친구들의 좋은 점을 찾는 특별한 능력이 생겼어요.',
  },
};

const RETRY_AUDIO_URL = fixedAudioUrl('system__stt_retry');

function SpeakerIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M4 9v6h4l5 4.5v-15L8 9H4z" />
      <path d="M15.8 8.6a4.6 4.6 0 0 1 0 6.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 6.2a8 8 0 0 1 0 11.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WaveBarsIcon({ className = 'h-[26px] w-8' }: { className?: string }) {
  const bars = [8, 20, 26, 14, 22, 10];
  return (
    <svg viewBox="0 0 34 26" className={className} aria-hidden>
      {bars.map((h, i) => (
        <rect key={i} x={i * 6} y={(26 - h) / 2} width="4" height={h} rx="2" fill="currentColor" />
      ))}
    </svg>
  );
}

function SpinnerIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden fill="none">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2.7"
        strokeLinecap="round"
        strokeDasharray="46"
        strokeDashoffset="18"
      />
    </svg>
  );
}

function MicIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <rect x="9" y="1.5" width="6" height="12.5" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 18v4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 팝업 로컬 단계 — 전역 턴 상태머신과 분리 (미션 중 대화 턴은 정지 상태) */
export type MissionPhase = 'IDLE' | 'RECORDING' | 'TRANSCRIBING' | 'REVIEW' | 'SUBMITTING' | 'SUCCESS';

export type MissionPopupProps = {
  /** dev UI 리허설(/dev/ui) 전용 — 초기 화면 상태 강제(성공 화면 미리보기). 실제 플로우에서는 전달하지 않는다. */
  devInitialPhase?: MissionPhase;
  /** fixtures `missions` 키 — 'mission_1'(대화3)·'mission_2'(대화4) */
  missionId: string;
  /** STT 장면 어휘 힌트용 external_id (sc_banggui_07 등) — /api/turn 응답의 노출 장면과 일치시킬 것 */
  sceneId: string;
  /**
   * 보내기 클릭 — 미션 응답 저장·대화 내역 표시·분석(/api/turn isMission, T041)은 컨테이너 책임.
   * resolve 시 [미션 성공 완료]로 전환, reject 시 같은 화면에서 '다시 보내기' 노출(응답 원문 유지).
   */
  onSubmit: (text: string, sttRawText: string) => Promise<void>;
  /** [미션 성공 완료]의 '이야기 계속하기' 클릭 — 컨테이너가 팝업을 닫고 턴 사이클(⑦ 종료 조건 확인)을 재개 */
  onContinue: () => void;
};

export function MissionPopup({ devInitialPhase, missionId, sceneId, onSubmit, onContinue }: MissionPopupProps) {
  const mission = missions[missionId];
  if (!mission) throw new Error(`fixtures missions에 없는 키: ${missionId}`); // 배선 오탈자 조기 발견 (assets.ts 관례)

  const [phase, setPhase] = useState<MissionPhase>(devInitialPhase ?? 'IDLE');
  const [stt, setStt] = useState<{ text: string; sttRawText: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitRetry, setSubmitRetry] = useState(false);
  const hintAudioRef = useRef<HTMLAudioElement | null>(null);

  const showRetryHint = useCallback(() => {
    // 게이트/STT 실패 공통 폴백 — 문구 + 안내음, 마이크 재클릭으로 재입력 (대화 화면과 동일 규칙)
    setStatusMessage('다시 한번 말해줄래?');
    const hint = hintAudioRef.current;
    if (hint) {
      hint.src = RETRY_AUDIO_URL;
      hint.currentTime = 0;
      void hint.play().catch(() => undefined); // 안내음 실패는 무시 — 문구가 이미 표시됨
    }
  }, []);

  const handleRecordingComplete = useCallback(
    async (result: RecordingResult) => {
      if (!result.precheck.ok) {
        setPhase('IDLE');
        showRetryHint(); // 무음·초단 녹음 — 서버 왕복 없이 재입력 유도
        return;
      }
      setPhase('TRANSCRIBING');
      try {
        const form = new FormData();
        form.append('audio', result.blob, result.mimeType.includes('mp4') ? 'utterance.mp4' : 'utterance.webm');
        form.append('sceneId', sceneId);
        form.append('context', 'mission');
        const res = await fetch('/api/stt', { method: 'POST', body: form });
        if (!res.ok) throw new Error(`STT HTTP ${res.status}`);
        const sttResult = (await res.json()) as SttResult;
        if (sttResult.failed) {
          setPhase('IDLE');
          showRetryHint();
          return;
        }
        setStt({ text: sttResult.text, sttRawText: sttResult.sttRawText });
        setStatusMessage(null);
        setPhase('REVIEW');
      } catch {
        setPhase('IDLE');
        showRetryHint();
      }
    },
    [sceneId, showRetryHint],
  );

  const recorder = useRecorder({ onComplete: handleRecordingComplete });

  const handleMicClick = useCallback(() => {
    if (recorder.isRecording) {
      recorder.stop(); // 재클릭으로 종료 → onComplete
      return;
    }
    setStt(null); // REVIEW에서 재녹음 시 이전 STT 결과 폐기 (T072) — 보내기 전에는 저장된 것 없음
    setStatusMessage(null);
    setPhase('RECORDING');
    void recorder.start();
  }, [recorder]);

  const requestSubmit = useCallback(
    async (text: string, sttRawText: string) => {
      setSubmitRetry(false);
      setPhase('SUBMITTING');
      try {
        await onSubmit(text, sttRawText);
        setPhase('SUCCESS'); // 팝업은 유지한 채 내부 콘텐츠만 전환
      } catch {
        // 컨테이너(/api/turn)가 이미 1회 재시도했으므로 여기서는 수동 재시도 (대화 화면과 동일 규칙)
        setSubmitRetry(true);
      }
    },
    [onSubmit],
  );

  const handleSubmit = useCallback(() => {
    if (phase !== 'REVIEW' || !stt?.text.trim()) return;
    void requestSubmit(stt.text, stt.sttRawText);
  }, [phase, requestSubmit, stt]);

  // REVIEW에서도 마이크 활성 — 보내기 전 재녹음 허용 (T072, E2E 항목 13)
  const micEnabled =
    (phase === 'IDLE' || phase === 'RECORDING' || phase === 'REVIEW') && recorder.status !== 'requesting';
  const sendEnabled = phase === 'REVIEW' && !!stt?.text.trim();
  const missionNumber = missionId === 'mission_2' ? (2 as const) : (1 as const);
  const success = SUCCESS_CONTENT[missionId] ?? SUCCESS_CONTENT.mission_1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-5"
      role="dialog"
      aria-modal="true"
      aria-label={mission.title}
    >
      <audio ref={hintAudioRef} hidden />
      {phase !== 'SUCCESS' ? (
        /* [미션 진행 중] — 그라데이션 헤더 + 미션 일러스트(안내 포인트 포함) + 안내/미리보기 스트립 + 마이크·보내기 */
        <section className="flex max-h-full w-full max-w-[770px] flex-col overflow-hidden rounded-[32px] bg-base shadow-[0_24px_64px_rgba(58,44,30,0.45)]">
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 bg-gradient-to-b from-primary to-berry px-6 py-2">
            <span className="shrink-0 rounded-xl bg-white px-3 py-1 font-display text-lg text-primary">
              미션 {missionNumber}
            </span>
            <h2 className="min-w-0 font-display text-[22px] leading-snug text-white">
              {MISSION_HEADLINES[missionId] ?? mission.goal}
            </h2>
          </div>

          <img
            src={missionImageUrl(missionNumber)}
            alt={mission.goal}
            className="min-h-0 w-full flex-1 bg-base object-contain"
          />

          {/* 안내/상태/미리보기 스트립 — 대화 화면과 동일 표기 규칙 (색+아이콘+텍스트 병행) */}
          <div className="flex min-h-[52px] shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1 border-y border-[#f0e4d3] bg-white px-5 py-2">
            {submitRetry && stt ? (
              <>
                <span className="text-lg text-ink">생각을 정리하는 중이에요...</span>
                <button
                  type="button"
                  onClick={() => void requestSubmit(stt.text, stt.sttRawText)}
                  className="h-12 rounded-full bg-primary px-5 font-display text-lg text-white active:bg-ink"
                >
                  다시 보내기
                </button>
              </>
            ) : phase === 'RECORDING' ? (
              <span className="flex items-center gap-2.5 font-display text-lg text-primary">
                <WaveBarsIcon />
                생각을 말해보세요!
              </span>
            ) : phase === 'TRANSCRIBING' ? (
              <span className="flex items-center gap-2.5 font-display text-lg text-ink">
                <SpinnerIcon />
                말을 글자로 바꾸는 중이에요!
              </span>
            ) : (phase === 'REVIEW' || phase === 'SUBMITTING') && stt ? (
              /* STT 미리보기 — 수정 불가, 표시 완료 시 보내기 활성 */
              <>
                <span className="shrink-0 text-lg font-bold text-sky">내가 한 말</span>
                <span className="min-w-0 flex-1 font-display text-xl leading-snug text-ink">“{stt.text}”</span>
                {phase === 'SUBMITTING' && (
                  <span className="animate-pulse font-display text-lg text-ink" role="status" aria-label="응답을 확인하는 중">
                    ● ● ●
                  </span>
                )}
              </>
            ) : (
              <span className="flex items-center gap-2.5 font-display text-lg text-[#8a7a68]">
                <SpeakerIcon />
                {ENCOURAGEMENT}
              </span>
            )}
            {statusMessage && <span className="text-lg font-bold text-primary">{statusMessage}</span>}
            {recorder.error && !statusMessage && (
              <span className="text-lg font-bold text-primary">{recorder.error}</span>
            )}
          </div>

          {/* 마이크(버튼 시작·원형 64px)·보내기 — 터치 48px+ */}
          <div className="flex min-h-[84px] shrink-0 items-center justify-center gap-4">
            <button
              type="button"
              onClick={handleMicClick}
              disabled={!micEnabled}
              aria-label={recorder.isRecording ? '말 끝났어요 — 녹음 끝내기' : phase === 'REVIEW' ? '다시 말하기' : '눌러서 말하기'}
              style={
                recorder.isRecording ? { transform: `scale(${1 + Math.min(recorder.level * 2, 0.15)})` } : undefined
              }
              className={`flex size-16 shrink-0 items-center justify-center rounded-full text-white transition-transform ${
                phase === 'TRANSCRIBING' ? 'bg-sunny shadow-[0_6px_20px_rgba(255,201,60,0.33)]' : 'bg-primary shadow-[0_6px_20px_rgba(255,122,61,0.33)]'
              } disabled:opacity-40`}
            >
              {recorder.isRecording ? <WaveBarsIcon /> : phase === 'TRANSCRIBING' ? <SpinnerIcon /> : <MicIcon />}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!sendEnabled}
              className="h-12 rounded-full bg-sage px-5 font-display text-xl text-white active:bg-ink disabled:opacity-40"
            >
              보내기 →
            </button>
          </div>
        </section>
      ) : (
        /* [미션 성공 완료] — 같은 팝업 안에서 전환, 이야기 계속하기로만 복귀 */
        <section className="flex max-h-full w-full max-w-[700px] flex-col overflow-y-auto rounded-[32px] bg-white px-5 pb-5 shadow-[0_4px_16px_rgba(58,44,30,0.10),0_24px_64px_rgba(58,44,30,0.18)]">
          <div className="relative shrink-0 rounded-b-[50%] bg-gradient-to-b from-[#fff5d4] to-[#ffede3] pt-2.5 pb-8 text-center">
            <p aria-hidden className="text-[56px] leading-none">
              🏆
            </p>
            <p aria-hidden className="absolute top-4 left-[38%] text-[22px] leading-none">
              ✨
            </p>
            <p aria-hidden className="absolute top-9 right-[38%] text-[22px] leading-none">
              ⭐
            </p>
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full bg-primary px-4 py-1.5 font-display text-lg whitespace-nowrap text-white shadow-[0_3px_10px_rgba(255,122,61,0.35)]">
              미션 {missionNumber}단계
            </span>
          </div>

          <h2 className="mt-8 text-center font-display text-3xl text-primary">잘했어요!</h2>
          <div className="mx-auto mt-1.5 h-1 w-[134px] shrink-0 rounded-full bg-sunny" aria-hidden />
          <p className="mt-3 text-center font-display text-[26px] leading-snug text-ink">{success.subtitle}</p>
          <p className="mt-3 text-center font-display text-lg leading-relaxed whitespace-pre-line text-ink">
            {success.desc}
          </p>

          <div className="mt-4 flex items-start justify-center gap-6">
            {success.stars.map((label) => (
              <span key={label} className="flex flex-col items-center gap-1">
                <span aria-hidden className="text-[28px] leading-none drop-shadow-[0_3px_6px_rgba(255,201,60,0.5)]">
                  ⭐
                </span>
                <span className="text-lg text-ink">{label}</span>
              </span>
            ))}
          </div>

          <div className="mt-5 flex shrink-0 items-center gap-3.5 rounded-3xl border border-[#ede5d8] bg-gradient-to-b from-[#ddf5ec] to-[#ddf0fb] px-4 py-3">
            <span aria-hidden className="text-4xl leading-none">
              🎖️
            </span>
            <span className="min-w-0">
              <p className="font-display text-lg text-ink">{success.badgeTitle}</p>
              <p className="mt-0.5 text-lg text-ink">{success.badgeDesc}</p>
            </span>
          </div>

          <button
            type="button"
            onClick={onContinue}
            className="mt-5 h-14 w-full shrink-0 rounded-full bg-primary font-display text-xl text-white shadow-[0_5px_10px_rgba(255,122,61,0.33)] active:bg-ink"
          >
            이야기 계속하기
          </button>
        </section>
      )}
    </div>
  );
}
