'use client';
// 재구성 발화 화면 (T054, 기능명세서 2.4.5 "단어로 문장만들기") — 장면 카드+핵심 단어 4세트(표시 전용,
// 2.4.4 배치 순서 = 정답 순서), 마이크 버튼 시작 녹음(자동 아님), "내가 한 말" 카드에 STT 결과 표시 후 보내기.
// 녹음→/api/stt(context=retelling)→표시→보내기 사이클은 미션 팝업(T042)과 같은 기계 구조지만 문구는 2.4.5 원문:
// 인식 실패 "다시 한 번 말해줄래요?"(대화·미션의 "다시 한번 말해줄래?"와 다름), 권한 거부 "마이크 사용을 허용해주세요".
// 저장·완료 처리(/api/post-activity kind:'retelling', T052)와 X 나가기·재진입 라우팅은 컨테이너(파트2 T055) 소유 —
// 접점은 onSubmit 콜백뿐, resolve 시 컨테이너가 2.5 학습 완료 화면으로 전환한다.
// 콘텐츠는 T051 post_activity_config가 SoT라 props로 받는다(fixtures 직접 로드 없음 — T051 합류 전에도 개발 가능).
// "핵심 단어 4개 포함 여부 검증"(2.4.5 유효성)은 차단 동작·문구가 미정의라 비차단 시각 피드백(포함 단어 ✓)으로만
// 반영 — 저장 차단은 하지 않는다(보내기 활성 조건은 원문대로 "텍스트 공백 아님"뿐, tasks.md에 기록).
import { useCallback, useRef, useState } from 'react';
import type { PostActivityCard } from '@/components/card-ordering';
import { useRecorder, type RecordingResult } from '@/hooks/useRecorder';
import type { SttResult } from '@/lib/contracts';
import { fixedAudioUrl } from '@/lib/fixed-audio';

export type { PostActivityCard } from '@/components/card-ordering';

const ERROR_STT_RETRY = '다시 한 번 말해줄래요?'; // 2.4.5 원문 — 2.4.3 계열 문구와 띄어쓰기·어미 다름
const ERROR_MIC_PERMISSION = '마이크 사용을 허용해주세요';
const RETRY_AUDIO_URL = fixedAudioUrl('system__stt_retry');

/** 화면 로컬 단계 — 미션 팝업과 동일 전이 */
type RetellingPhase = 'IDLE' | 'RECORDING' | 'TRANSCRIBING' | 'REVIEW' | 'SUBMITTING';

export type RetellingProps = {
  /** 장면 카드 4컷 — 2.4.4에서 배치한 순서(=정답 순서)대로 컨테이너가 정렬해 전달 */
  cards: PostActivityCard[];
  /** 핵심 단어 4개 (post_activity_config.keywords) — cards와 인덱스로 짝지어 4세트 표시 */
  keywords: string[];
  /** STT 어휘 힌트용 장면 external_id — 미지정 시 기본 어휘(제목·주제·캐릭터)만 사용 */
  sceneId?: string;
  /**
   * 보내기 클릭 — retelling_text·completed_at 저장(/api/post-activity, T052)은 컨테이너 책임.
   * resolve 시 컨테이너가 2.5 학습 완료 화면으로 전환, reject 시 현재 화면 유지·'다시 보내기' 노출(원문 유지).
   */
  onSubmit: (retellingText: string) => Promise<void>;
};

export function Retelling({ cards, keywords, sceneId, onSubmit }: RetellingProps) {
  const [phase, setPhase] = useState<RetellingPhase>('IDLE');
  const [stt, setStt] = useState<{ text: string; sttRawText: string } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitRetry, setSubmitRetry] = useState(false);
  const hintAudioRef = useRef<HTMLAudioElement | null>(null);

  const showRetryHint = useCallback(() => {
    // 무음·인식 실패 공통 — "내가 한 말" 카드는 비워둔 채 유지, 마이크 재클릭으로만 재시도 (2.4.5 예외 처리)
    setStt(null);
    setStatusMessage(ERROR_STT_RETRY);
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
        if (sceneId) form.append('sceneId', sceneId);
        form.append('context', 'retelling');
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
    // 재녹음(보내기 전 횟수 제한 없음) — 권한 거부 후 재클릭 시 start()가 권한을 재요청한다 (2.4.5 복구)
    setStatusMessage(null);
    setPhase('RECORDING');
    void recorder.start();
  }, [recorder]);

  const requestSubmit = useCallback(
    async (text: string) => {
      setSubmitRetry(false);
      setPhase('SUBMITTING');
      try {
        await onSubmit(text);
        // 성공 시 2.5 전환은 컨테이너(T055) 책임 — 이 컴포넌트는 언마운트된다
      } catch {
        setSubmitRetry(true); // 실패 → 현재 화면 유지, 수동 재시도 (2.4.5 화면 이동)
      }
    },
    [onSubmit],
  );

  const handleSubmit = useCallback(() => {
    if (phase !== 'REVIEW' || !stt?.text.trim()) return;
    void requestSubmit(stt.text);
  }, [phase, requestSubmit, stt]);

  const micEnabled = (phase === 'IDLE' || phase === 'RECORDING' || phase === 'REVIEW') && recorder.status !== 'requesting';
  const sendEnabled = phase === 'REVIEW' && !!stt?.text.trim(); // 텍스트 표시 완료 전까지 비활성 (2.4.5 구성요소)

  return (
    <section className="flex flex-1 flex-col items-center gap-5 px-6 pb-8">
      <audio ref={hintAudioRef} hidden />

      {/* 활동 안내 (T067, E2E 항목 28) — 2.4.4 카드 배열 안내와 동일 스타일 */}
      <p className="text-center font-display text-2xl text-ink">
        장면 카드와 핵심 단어를 보고, 이야기를 처음부터 끝까지 말해보세요!
      </p>

      {/* 장면 카드 + 핵심 단어 4세트 — 표시 전용, 사용자 조작 불가 (2.4.5 구성요소) */}
      <div className="grid w-full max-w-3xl grid-cols-4 gap-3">
        {cards.map((card, index) => {
          const keyword = keywords[index];
          const included = !!keyword && !!stt?.text.includes(keyword); // 포함 여부 시각 피드백 (비차단)
          return (
            <figure key={card.id} className="flex flex-col items-center gap-1 rounded-2xl bg-white p-2">
              <img src={card.imageUrl} alt={card.label} className="aspect-square w-full rounded-xl object-cover" />
              {keyword && (
                <figcaption
                  className={`rounded-full px-3 py-1 text-lg font-semibold ${
                    included ? 'bg-sage text-white' : 'bg-sunny text-ink'
                  }`}
                >
                  {included ? '✓ ' : ''}
                  {keyword}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>

      {/* 내가 한 말 — 상시 노출 카드, 인식 실패 시 비워둔 채 유지 (2.4.5) */}
      <div className="w-full max-w-2xl">
        <p className="mb-1 text-lg font-semibold text-ink">내가 한 말</p>
        <p
          className={`min-h-20 w-full rounded-2xl border-2 bg-white px-4 py-3 text-center text-xl ${
            stt ? 'border-primary text-ink' : 'border-white text-ink/40'
          }`}
        >
          {stt ? `“${stt.text}”` : '마이크를 눌러 이야기를 들려주세요'}
        </p>
      </div>

      {/* 상태 배지 / 안내 문구 — 색+아이콘+텍스트 병행 (FR-020) */}
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
          <span className="animate-pulse text-2xl text-ink" role="status" aria-label="이야기를 보내는 중">
            ● ● ●
          </span>
        )}
        {statusMessage && <span className="text-lg font-semibold text-primary">{statusMessage}</span>}
        {recorder.status === 'error' && !statusMessage && (
          <span className="text-lg font-semibold text-primary">{ERROR_MIC_PERMISSION}</span>
        )}
        {submitRetry && stt && (
          <>
            <span className="text-lg text-ink">이야기를 정리하는 중이에요...</span>
            <button
              type="button"
              onClick={() => void requestSubmit(stt.text)}
              className="h-12 rounded-full bg-primary px-5 text-lg font-bold text-white active:bg-ink"
            >
              다시 보내기
            </button>
          </>
        )}
      </div>

      {/* 마이크(버튼 시작·재녹음 겸용)·보내기 — 터치 48px+ (FR-020) */}
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
          🎤 {recorder.isRecording ? '말 끝났어요!' : stt ? '다시 말하기' : '눌러서 말하기'}
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
    </section>
  );
}
