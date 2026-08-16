'use client';
// 재구성 발화 화면 (T054, 기능명세서 2.4.5 "단어로 문장만들기") — 장면 카드+핵심 단어 세트(표시 전용,
// 2.4.4 배치 순서 = 정답 순서, 세트 수 = post_activity_config.cards 길이), 마이크 버튼 시작 녹음(자동 아님),
// "내가 한 말" 카드에 STT 결과 표시 후 보내기.
// 녹음→/api/stt(context=retelling)→표시→보내기 사이클은 미션 팝업(T042)과 같은 기계 구조지만 문구는 2.4.5 원문:
// 인식 실패 "다시 한 번 말해줄래요?"(대화·미션의 "다시 한번 말해줄래?"와 다름), 권한 거부 "마이크 사용을 허용해주세요".
// 저장·완료 처리(/api/post-activity kind:'retelling', T052)와 X 나가기·재진입 라우팅은 컨테이너(파트2 T055) 소유 —
// 접점은 onSubmit 콜백뿐, resolve 시 컨테이너가 2.5 학습 완료 화면으로 전환한다.
// 콘텐츠는 T051 post_activity_config가 SoT라 props로 받는다(fixtures 직접 로드 없음 — T051 합류 전에도 개발 가능).
// "핵심 단어 4개 포함 여부 검증"(2.4.5 유효성)은 차단 동작·문구가 미정의라 비차단 시각 피드백(포함 단어 ✓)으로만
// 반영 — 저장 차단은 하지 않는다(보내기 활성 조건은 원문대로 "텍스트 공백 아님"뿐, tasks.md에 기록).
// 스타일: 피그마 「개발 배포용」 2.4.5 — 카드+단어 칩 4세트·하늘색 "내가 한 말" 카드·원형 마이크+보내기 필.
import { useCallback, useRef, useState } from 'react';
import type { PostActivityCard } from '@/components/card-ordering';
import { CheckIcon, PencilIcon } from '@/components/icons';
import { useRecorder, type RecordingResult } from '@/hooks/useRecorder';
import type { SttResult } from '@/lib/contracts';
import { fixedAudioUrl } from '@/lib/fixed-audio';
import { keywordIncluded } from '@/lib/retelling-keywords';

export type { PostActivityCard } from '@/components/card-ordering';

const ERROR_STT_RETRY = '다시 한 번 말해줄래요?'; // 2.4.5 원문 — 2.4.3 계열 문구와 띄어쓰기·어미 다름
const ERROR_MIC_PERMISSION = '마이크 사용을 허용해주세요';
const RETRY_AUDIO_URL = fixedAudioUrl('system__stt_retry');

/** 화면 로컬 단계 — 미션 팝업과 동일 전이 */
type RetellingPhase = 'IDLE' | 'RECORDING' | 'TRANSCRIBING' | 'REVIEW' | 'SUBMITTING';

/** 마이크 글리프 — 스토리보드 흰 아웃라인(스트로크) 스타일 (2026-08-13 시안 대조) */
function MicIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <rect x="9.2" y="2.5" width="5.6" height="11" rx="2.8" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3.5" />
    </svg>
  );
}

export type RetellingProps = {
  /** 장면 카드 4컷 — 2.4.4에서 배치한 순서(=정답 순서)대로 컨테이너가 정렬해 전달 */
  cards: PostActivityCard[];
  /** keywords[i] = cards[i] 장면의 핵심 단어 묶음 (post_activity_config.keywords) — 카드 아래 칩으로 나열 */
  keywords: string[][];
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
  const micLabel = recorder.isRecording ? '말 끝났어요! (녹음 마치기)' : stt ? '다시 말하기' : '눌러서 말하기';

  return (
    // 뷰포트가 시안(834)보다 낮으면(태블릿 Safari 주소창 등) 세로 스크롤 허용 — 하단 마이크·보내기가 잘려
    // 클릭 불가하던 QA(2026-08-16) 해소. 이미지 축소 수납안은 카드가 띠처럼 뭉개져 스크롤로 확정(사용자 결정 08/16).
    // 아이 화면 무스크롤 원칙(핸드오프 §2)의 예외 — 콘텐츠가 넘칠 때만 스크롤이 생긴다.
    <section className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-6 pt-8">
      <audio ref={hintAudioRef} hidden />

      {/* 활동 안내 — 스토리보드(피그마 2.4.5) 원문. 실측(2026-08-14): 제목 32 · 보조 22 #8A7A68 · 간격 8 */}
      <div className="shrink-0">
        <p className="font-display text-[32px] leading-snug text-ink">
          아래 단어들을 넣어서 나만의 이야기를 만들어 보세요
        </p>
        <p className="mt-2 font-display text-[22px] text-[#8A7A68]">
          &quot;며느리는 솔직하게 말하기로 했어요&quot;처럼 자유롭게 이야기를 들려주세요
        </p>
      </div>

      {/* 장면 카드 + 핵심 단어 세트 — 표시 전용, 사용자 조작 불가 (2.4.5 구성요소).
          스토리보드처럼 콘텐츠 높이만 차지(flex-1 미사용) — 아래 요소들이 위로 붙는다. 뷰포트가 낮으면
          카드를 줄이지 않고 섹션 스크롤로 넘긴다(사용자 결정 08/16 — 축소는 카드가 띠처럼 뭉개짐).
          열 수는 카드 수를 따른다(하드코딩 4 제거 — 콘텐츠 교체만으로 장면 수가 바뀌어도 따라간다) */}
      <div
        style={{ gridTemplateColumns: `repeat(${Math.max(cards.length, 1)}, minmax(0, 1fr))` }}
        className="grid shrink-0 gap-4"
      >
        {cards.map((card, index) => {
          const sceneKeywords = keywords[index] ?? [];
          return (
            <figure key={card.id} className="flex min-h-0 flex-col gap-2.5">
              {/* 피그마 장면 카드 275×218 비율 고정 — flex 잔여 공간이 카드를 세로로 늘리지 않게 */}
              <div className="aspect-[275/218] w-full min-h-0 overflow-hidden rounded-2xl border-[1.5px] border-[#F0E4D3] bg-white shadow-[0_6px_18px_rgba(58,44,30,0.08)]">
                {/* eslint-disable-next-line @next/next/no-img-element -- Storage 외부 URL (기존 화면과 동일 패턴) */}
                <img src={card.imageUrl} alt={card.label} className="h-full w-full object-cover" />
              </div>
              {/* 칩 글자 — 피그마 원색 sage 채택(2026-08-14 "피그마와 동일하게" 지시, 대비 미달 인지).
                  포함(✓) 상태는 시안 미정의라 기존 채움 피드백 유지.
                  시안은 장면당 칩 1개지만 QA 12로 장면별 핵심 단어를 3~4개 주기로 했다 —
                  카드 폭 안에서 2열 그리드로 쌓아 칩 너비를 고르게 맞춘다(기획 전달 시안 2026-08-15) */}
              {sceneKeywords.length > 0 && (
                <figcaption className="grid shrink-0 grid-cols-2 gap-1.5">
                  {sceneKeywords.map((keyword) => {
                    // 포함 여부 시각 피드백 (비차단) — 활용형(미안함→미안해요 등)까지 인식 (#84 검증)
                    const included = !!stt && keywordIncluded(stt.text, keyword);
                    return (
                      <span
                        key={keyword}
                        className={`flex h-11 items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-sage px-2 font-display text-lg ${
                          included ? 'bg-sage text-ink' : 'bg-sage/10 text-sage'
                        }`}
                      >
                        {included && <CheckIcon className="w-3.5 shrink-0" />}
                        {keyword}
                      </span>
                    );
                  })}
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>

      {/* 내가 한 말 — 상시 노출 카드, 인식 실패 시 비워둔 채 유지 (2.4.5).
          실측(2026-08-14): pad 20 · 라벨 18 Bold sky 원색(대비 미달 인지 채택) · 본문 22 간격 12 */}
      <div className="w-full shrink-0 rounded-[20px] border border-sky/25 bg-[#DDF0FB]/80 p-5">
        <p className="text-lg font-bold text-sky">내가 한 말</p>
        <p className={`mt-3 min-h-14 font-display text-[22px] leading-normal ${stt ? 'text-ink' : 'text-ink/70'}`}>
          {stt ? stt.text : '마이크를 눌러 이야기를 들려주세요'}
        </p>
      </div>

      {/* 상태 배지 / 안내 문구 — 색+아이콘+텍스트 병행 (FR-020). 비어 있을 때 높이 미점유 —
          '내가 한 말' 카드와 버튼 사이 간격 축소, 내용 등장 시엔 위 카드 영역(flex-1)이 줄어들어 버튼 위치 불변 */}
      <div className="flex min-h-0 shrink-0 items-center justify-center gap-3 empty:hidden">
        {phase === 'RECORDING' && (
          <span className="flex h-10 items-center gap-2 rounded-full bg-sunny px-5 text-lg font-semibold text-ink">
            <MicIcon className="size-5" />
            생각을 말해보세요!
          </span>
        )}
        {phase === 'TRANSCRIBING' && (
          <span className="flex h-10 items-center gap-2 rounded-full bg-sunny px-5 text-lg font-semibold text-ink">
            <PencilIcon className="size-5" />
            말을 글자로 바꾸는 중이에요!
          </span>
        )}
        {phase === 'SUBMITTING' && !submitRetry && (
          <span className="animate-pulse text-2xl text-ink" role="status" aria-label="이야기를 보내는 중">
            ● ● ●
          </span>
        )}
        {statusMessage && <span className="text-lg font-semibold text-[#B84A12]">{statusMessage}</span>}
        {recorder.status === 'error' && !statusMessage && (
          <span className="text-lg font-semibold text-[#B84A12]">{ERROR_MIC_PERMISSION}</span>
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

      {/* 마이크(버튼 시작·재녹음 겸용)·보내기 — 피그마 실측(2026-08-14 재대조): 마이크 원형 88·글리프 28·
          간격 16·보내기 h48 pad 20·마이크 그림자 (0,10,28,-8) primary 33% */}
      <div className="flex shrink-0 items-center justify-center gap-4">
        <button
          type="button"
          onClick={handleMicClick}
          disabled={!micEnabled}
          aria-label={micLabel}
          style={
            recorder.isRecording ? { transform: `scale(${1 + Math.min(recorder.level * 2, 0.15)})` } : undefined
          }
          className={`flex size-22 items-center justify-center rounded-full text-white shadow-[0_10px_28px_-8px_rgba(255,122,61,0.33)] transition-transform ${
            recorder.isRecording ? 'bg-sunny' : 'bg-primary'
          } disabled:opacity-40`}
        >
          <MicIcon className="size-7" />
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!sendEnabled}
          // 시안 확정(2026-08-13 사용자 지시): sage + 흰 글자 — 대비 2.4:1로 하한(4.5:1) 미달임을 인지하고 채택
          className="h-12 rounded-full bg-sage px-5 font-display text-lg font-bold text-white active:bg-ink disabled:opacity-40"
        >
          보내기 →
        </button>
      </div>
    </section>
  );
}
