'use client';
// 미션 오버레이 팝업 (T042, 기능명세서 2.4.3 미션) — 대화 화면 위 단일 오버레이(새 화면 아님, URL·네비게이션 변화 없음).
// 열릴 때부터 닫힐 때까지 하나의 오버레이로 유지되며 내부 콘텐츠만 [미션 진행 중]→[미션 성공 완료]로 전환(진행률 바 없음).
// 캐릭터 음성 재생 없이 화면만 표시하고 아이의 답을 기다린다.
// 마이크는 버튼 시작(자동 아님) — 기능명세서 구성요소 표 기준. 같은 문서의 기능 설명 ⓐ(자동 시작)와 상충하며,
// tasks.md T042가 버튼 시작으로 확정(미션 안내를 읽을 시간이 필요 — 대화 턴의 자동 시작과 구분).
// 노출 판정(T040)·저장/분석(/api/turn isMission, T041)은 파트2 소유 — 이 컴포넌트의 접점은 onSubmit/onContinue 콜백뿐이며
// 상태도 전역 turn 스토어(T033)와 무관한 팝업 로컬 상태만 쓴다(뒤의 대화 턴 사이클을 건드리지 않음).
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

/** 성공 완료 콘텐츠 — 미션마다 상이하나 MVP는 고정 문구 (기능명세서 2.4.3) */
const SUCCESS_MESSAGES: Record<string, string> = {
  mission_1: '멋진 방법이야! 며느리의 방귀로 높은 배나무의 배를 떨어뜨릴 수 있겠어!',
  mission_2: '정말 멋져! 단점처럼 보이는 특징도 좋은 일에 쓸 수 있다는 걸 찾아냈구나!',
};

const RETRY_AUDIO_URL = fixedAudioUrl('system__stt_retry');

/** 팝업 로컬 단계 — 전역 턴 상태머신과 분리 (미션 중 대화 턴은 정지 상태) */
type MissionPhase = 'IDLE' | 'RECORDING' | 'TRANSCRIBING' | 'REVIEW' | 'SUBMITTING' | 'SUCCESS';

export type MissionPopupProps = {
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

export function MissionPopup({ missionId, sceneId, onSubmit, onContinue }: MissionPopupProps) {
  const mission = missions[missionId];
  if (!mission) throw new Error(`fixtures missions에 없는 키: ${missionId}`); // 배선 오탈자 조기 발견 (assets.ts 관례)

  const [phase, setPhase] = useState<MissionPhase>('IDLE');
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={mission.title}
    >
      <audio ref={hintAudioRef} hidden />
      <section className="flex max-h-full w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        {phase !== 'SUCCESS' ? (
          <>
            {/* [미션 진행 중] — 안내 카드: 제목·이미지·목표·안내 포인트/예시 */}
            <p className="font-display text-lg text-primary">미션 {missionNumber}</p>
            <h2 className="font-display text-2xl text-ink">{mission.title}</h2>
            <img
              src={missionImageUrl(missionNumber)}
              alt=""
              className="max-h-[22vh] w-full rounded-2xl object-contain"
            />
            <p className="text-xl leading-relaxed text-ink">{mission.goal}</p>
            {mission.purpose && <p className="text-lg leading-relaxed text-ink">{mission.purpose}</p>}
            {mission.guide_points && (
              <ul className="flex flex-col gap-1">
                {mission.guide_points.map((point) => (
                  <li key={point} className="rounded-2xl bg-sunny px-4 py-2 text-lg text-ink">
                    {point}
                  </li>
                ))}
              </ul>
            )}
            {mission.examples && (
              <ul className="flex flex-col gap-1">
                {mission.examples.map((example) => (
                  <li key={example} className="rounded-2xl bg-sunny px-4 py-2 text-lg text-ink">
                    {example}
                  </li>
                ))}
              </ul>
            )}

            {/* 상태 배지 / 처리 중 로딩(라벨 없음) / 안내 문구 — 대화 화면과 동일 표기 */}
            <div className="flex min-h-12 items-center gap-3">
              {phase === 'RECORDING' && (
                <span className="flex h-12 items-center gap-2 rounded-full bg-sunny px-5 text-lg font-semibold text-ink">
                  <span aria-hidden>🎤</span>
                  생각을 말해보세요!
                </span>
              )}
              {phase === 'TRANSCRIBING' && (
                <span className="flex h-12 items-center gap-2 rounded-full bg-sunny px-5 text-lg font-semibold text-ink">
                  <span aria-hidden>✍️</span>
                  말을 글자로 바꾸는 중이에요!
                </span>
              )}
              {phase === 'SUBMITTING' && !submitRetry && (
                <span className="animate-pulse text-2xl text-ink" role="status" aria-label="응답을 확인하는 중">
                  ● ● ●
                </span>
              )}
              {statusMessage && <span className="text-lg font-semibold text-primary">{statusMessage}</span>}
              {recorder.error && !statusMessage && (
                <span className="text-lg font-semibold text-primary">{recorder.error}</span>
              )}
              {submitRetry && stt && (
                <>
                  <span className="text-lg text-ink">생각을 정리하는 중이에요...</span>
                  <button
                    type="button"
                    onClick={() => void requestSubmit(stt.text, stt.sttRawText)}
                    className="h-12 rounded-full bg-primary px-5 text-lg font-bold text-white active:bg-ink"
                  >
                    다시 보내기
                  </button>
                </>
              )}
            </div>

            {/* STT 미리보기 — 수정 불가, 표시 완료 시 보내기 활성 */}
            {(phase === 'REVIEW' || phase === 'SUBMITTING') && stt && (
              <p className="w-full rounded-2xl border-2 border-primary bg-white px-4 py-3 text-center text-xl text-ink">
                “{stt.text}”
              </p>
            )}

            {/* 마이크(버튼 시작)·보내기 — 터치 48px+, 색+아이콘+텍스트 병행 */}
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleMicClick}
                disabled={!micEnabled}
                style={
                  recorder.isRecording ? { transform: `scale(${1 + Math.min(recorder.level * 2, 0.15)})` } : undefined
                }
                className={`flex h-16 items-center gap-2 rounded-full px-8 text-xl font-bold transition-transform ${
                  recorder.isRecording ? 'bg-primary text-white' : 'bg-white text-ink shadow'
                } disabled:opacity-40`}
              >
                🎤 {recorder.isRecording ? '말 끝났어요!' : phase === 'REVIEW' ? '다시 말하기' : '눌러서 말하기'}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!sendEnabled}
                className="h-16 rounded-full bg-primary px-8 text-xl font-bold text-white active:bg-ink disabled:opacity-40"
              >
                보내기
              </button>
            </div>
          </>
        ) : (
          <>
            {/* [미션 성공 완료] — 같은 팝업 안에서 전환, 이야기 계속하기로만 복귀 */}
            <p aria-hidden className="text-center text-5xl">
              🎉
            </p>
            <h2 className="text-center font-display text-3xl text-primary">미션 성공!</h2>
            <p className="text-center text-xl leading-relaxed text-ink">
              {SUCCESS_MESSAGES[missionId] ?? '정말 멋진 생각이야!'}
            </p>
            <button
              type="button"
              onClick={onContinue}
              className="mx-auto h-16 rounded-full bg-primary px-8 text-xl font-bold text-white active:bg-ink"
            >
              이야기 계속하기
            </button>
          </>
        )}
      </section>
    </div>
  );
}
