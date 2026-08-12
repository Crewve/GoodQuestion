'use client';
// 대화 장면 (T037, 기능명세서 2.4.3) — 턴 사이클 UI. 상태 전이는 turn 스토어(T033)가 소유하고
// 이 컴포넌트는 오디오·녹음·API 이벤트만 배선한다:
// 캐릭터 대사 자동 재생 → 재생 종료 시 녹음 자동 시작 → 마이크 버튼으로 종료 → 사전 게이트 → /api/stt
// → REVIEW(수정 불가 미리보기) → 보내기 클릭 시에만 /api/turn → 응답 재생 → 반복.
// CLOSING(sceneEnd) 응답은 고정 오디오 재생을 마친 뒤 onSceneEnd 호출 — 장면 전환은 컨테이너(T038) 몫.
// 폴백(contracts 매트릭스): 게이트/STT 실패 = "다시 한번 말해줄래?" + 마이크 재클릭, 턴 실패 = 다시 보내기,
// audioUrl 없음(TTS 장애) = 텍스트만 표시하고 즉시 다음 단계, 자동재생 차단 = 다시 듣기 탭이 복구 경로.
import { useCallback, useEffect, useRef, useState } from 'react';
import { MissionPopup } from '@/components/mission-popup';
import { useRecorder, type RecordingResult } from '@/hooks/useRecorder';
import { substituteChildName } from '@/lib/child-name';
import type { SttResult, ThinkingElement } from '@/lib/contracts';
import { fixedAudioUrl } from '@/lib/fixed-audio';
import { PHASE_LABELS, useTurnStore } from '@/store/turn';
import story from '../../fixtures/story.banggui.json';

export type DialogueScenePayload = {
  id: string;
  order: number;
  characterName?: string;
  characterImageUrl?: string;
  /** 오프닝 표시 텍스트 — /api/sessions가 openingAudioUrl과 표기를 맞춰 내려줌 (실명본↔실명, 폴백↔'친구') */
  openingText?: string;
  /** 오프닝 오디오 — 실명 합성본 또는 '친구야' 고정본 (/api/sessions R-07) */
  openingAudioUrl?: string;
  imageUrl?: string;
};

type DialogueSceneProps = {
  sessionId: string;
  scene: DialogueScenePayload;
  /** 실명 호출(R-07) — 미전달 시 '친구야' 표기 폴백 (고정 오디오와 일치) */
  childName?: string | null;
  /** CLOSING 오디오 종료 후 호출 — nextSceneId=null이면 대화 구간 마지막(후속 활동으로) */
  onSceneEnd: (nextSceneId: string | null) => void;
};

type Bubble = { speaker: 'child' | 'character'; text: string };

type TurnResponse = {
  mode: 'NORMAL' | 'GUIDED' | 'CLOSING';
  characterReplyText: string;
  audioUrl: string | null;
  /** 미션 분기 (T041) — 노출은 이 필드로만 전달, 판정은 서버 전용 */
  exposeMission?: string;
  missionPhase?: 'progress' | 'success';
  sceneEnd?: { reason: 'GOAL_MET' | 'MAX_TURNS'; nextSceneId: string | null };
  progress: { accumulated: ThinkingElement[]; missing: ThinkingElement[]; turn: number; maxTurns: number };
};

type FixtureSceneLite = { external_id: string; scene_order: number; character_opening?: string };
const fixtureScenes = (story as { scenes: FixtureSceneLite[] }).scenes;

const RETRY_AUDIO_URL = fixedAudioUrl('system__stt_retry');

const PHASE_ICONS: Record<string, string> = {
  CHAR_SPEAKING: '👂',
  RECORDING: '🎤',
  TRANSCRIBING: '✍️',
};

export function DialogueScene({ sessionId, scene, childName, onSceneEnd }: DialogueSceneProps) {
  const phase = useTurnStore((s) => s.phase);
  const sttText = useTurnStore((s) => s.sttText);

  const [history, setHistory] = useState<Bubble[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  const [turnRetry, setTurnRetry] = useState<{ text: string; sttRawText: string } | null>(null);
  /** 열린 미션 팝업 (T042 배선) — 서버 exposeMission으로만 열린다 */
  const [activeMission, setActiveMission] = useState<string | null>(null);
  /** 미션 응답의 캐릭터 대사 — 팝업 [성공 완료]가 닫힐 때 재생 (기능명세서 ⓕ→⑦) */
  const heldReplyRef = useRef<Pick<TurnResponse, 'characterReplyText' | 'audioUrl' | 'sceneEnd'> | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hintAudioRef = useRef<HTMLAudioElement | null>(null);
  const playTokenRef = useRef(0);
  /** undefined=장면 계속, string|null=응답 오디오 종료 후 전달할 nextSceneId */
  const pendingSceneEndRef = useRef<string | null | undefined>(undefined);
  const historyEndRef = useRef<HTMLDivElement | null>(null);

  const historyRef = useRef<Bubble[]>(history);
  historyRef.current = history;
  const onSceneEndRef = useRef(onSceneEnd);
  onSceneEndRef.current = onSceneEnd;

  const fixtureScene = fixtureScenes.find((s) => s.scene_order === scene.order);

  // --- 녹음 ---

  const showRetryHint = useCallback(() => {
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
        // 무음·초단 녹음 — 서버 왕복 없이 재입력 유도 (마이크 재클릭, 기능명세서 예외 규칙)
        showRetryHint();
        return;
      }
      useTurnStore.getState().stopRecording(); // → TRANSCRIBING
      try {
        const form = new FormData();
        form.append('audio', result.blob, result.mimeType.includes('mp4') ? 'utterance.mp4' : 'utterance.webm');
        form.append('sceneId', fixtureScene?.external_id ?? scene.id); // sc_*가 장면 어휘 힌트에 유리 (T030)
        form.append('context', 'dialogue');
        const lastCharacter = [...historyRef.current].reverse().find((b) => b.speaker === 'character');
        if (lastCharacter) form.append('characterReply', lastCharacter.text); // 직전 질문 힌트
        const res = await fetch('/api/stt', { method: 'POST', body: form });
        if (!res.ok) throw new Error(`STT HTTP ${res.status}`);
        const stt = (await res.json()) as SttResult;
        useTurnStore.getState().sttSucceeded(stt); // failed=true → RECORDING 복귀
        if (stt.failed) showRetryHint();
        else setStatusMessage(null);
      } catch {
        useTurnStore.getState().sttFailed(); // 네트워크 등 — RECORDING 복귀
        showRetryHint();
      }
    },
    [fixtureScene?.external_id, scene.id, showRetryHint],
  );

  const recorder = useRecorder({ onComplete: handleRecordingComplete });
  const recorderStartRef = useRef(recorder.start);
  recorderStartRef.current = recorder.start;

  // --- 캐릭터 오디오 ---

  const beginRecordingPhase = useCallback(() => {
    const store = useTurnStore.getState();
    if (store.phase !== 'CHAR_SPEAKING') return; // 다시 듣기 재생 종료 등 — 진행 상태 유지
    store.characterAudioEnded(); // → RECORDING
    setStatusMessage(null);
    void recorderStartRef.current(); // 자동 녹음 시작 (FR-007)
  }, []);

  const afterCharacterAudio = useCallback(() => {
    const pending = pendingSceneEndRef.current;
    if (pending !== undefined) {
      pendingSceneEndRef.current = undefined;
      onSceneEndRef.current(pending);
      return;
    }
    beginRecordingPhase();
  }, [beginRecordingPhase]);

  const playCharacterAudio = useCallback(
    (url: string | null | undefined) => {
      setLastAudioUrl(url ?? null);
      const audio = audioRef.current;
      if (!url || !audio) {
        afterCharacterAudio(); // TTS 폴백 — 텍스트는 이미 표시, 흐름은 계속
        return;
      }
      const token = ++playTokenRef.current;
      const done = () => {
        if (playTokenRef.current !== token) return; // ended/error/catch 중복 호출 가드
        playTokenRef.current += 1;
        afterCharacterAudio();
      };
      audio.onended = done;
      audio.onerror = done;
      audio.src = url;
      audio.currentTime = 0;
      void audio.play().catch((error: unknown) => {
        if ((error as DOMException)?.name === 'NotAllowedError') {
          // 자동재생 차단(새로고침 직행 등) — 다시 듣기 탭이 제스처가 되어 복구
          setStatusMessage('🔊 다시 듣기를 눌러 소리를 들어 보자!');
          return;
        }
        done();
      });
    },
    [afterCharacterAudio],
  );

  const replayAudio = useCallback(() => {
    // 반복 가능 — 턴 진행·상태에는 영향 없음 (재생 종료 콜백은 phase 가드로 무시됨)
    if (lastAudioUrl) {
      setStatusMessage(null);
      playCharacterAudio(lastAudioUrl);
    }
  }, [lastAudioUrl, playCharacterAudio]);

  // --- 턴 제출 ---

  const requestTurn = useCallback(
    async (text: string, sttRawText: string) => {
      setTurnRetry(null);
      try {
        const res = await fetch('/api/turn', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, sceneId: scene.id, text, sttRawText }),
        });
        if (!res.ok) throw new Error(`turn HTTP ${res.status}`);
        const turn = (await res.json()) as TurnResponse;
        if (turn.exposeMission) {
          // 노출 턴 — 캐릭터 응답 없음, 팝업이 마이크·보내기를 소유 (전역 턴은 SUBMITTED 유지)
          setActiveMission(turn.exposeMission);
          return;
        }
        setHistory((h) => [...h, { speaker: 'character', text: turn.characterReplyText }]);
        pendingSceneEndRef.current = turn.sceneEnd ? turn.sceneEnd.nextSceneId : undefined;
        useTurnStore.getState().characterSpeaking(); // SUBMITTED → CHAR_SPEAKING
        playCharacterAudio(turn.audioUrl);
      } catch {
        // 서버가 이미 1회 재시도했으므로 클라이언트는 수동 재시도 (기능명세서 예외 규칙)
        setTurnRetry({ text, sttRawText });
      }
    },
    [playCharacterAudio, scene.id, sessionId],
  );

  const handleSubmit = useCallback(() => {
    const store = useTurnStore.getState();
    if (store.phase !== 'REVIEW' || !store.sttText?.trim()) return;
    const text = store.sttText;
    const raw = store.sttRawText ?? text;
    store.submit(); // → SUBMITTED (보내기 시점에만 저장·분석 — 계약)
    setHistory((h) => [...h, { speaker: 'child', text }]);
    void requestTurn(text, raw);
  }, [requestTurn]);

  const handleMicClick = useCallback(() => {
    if (recorder.isRecording) {
      recorder.stop(); // 녹음 종료 → onComplete
      return;
    }
    // REVIEW에서 재클릭 = 재녹음 (T072) — 보내기 전까지 아무것도 저장되지 않으므로 STT 결과만 버린다
    useTurnStore.getState().rerecord();
    // 게이트/STT 실패 후 재입력 — 마이크 재클릭으로 재시작 (권한 거부 시 시스템 팝업 재노출 경로 겸용)
    setStatusMessage(null);
    void recorder.start();
  }, [recorder]);

  // --- 미션 팝업 배선 (T042 합류) ---

  const handleMissionSubmit = useCallback(
    async (missionText: string, missionRaw: string) => {
      // reject 시 팝업이 '다시 보내기'를 노출하므로 여기서는 실패를 삼키지 않는다
      const res = await fetch('/api/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, sceneId: scene.id, text: missionText, sttRawText: missionRaw, isMission: true }),
      });
      if (!res.ok) throw new Error(`turn HTTP ${res.status}`);
      const turn = (await res.json()) as TurnResponse;
      setHistory((h) => [...h, { speaker: 'child', text: missionText }]); // 미션 응답도 대화 내역에 표시 (기능명세서 ⓓ)
      heldReplyRef.current = {
        characterReplyText: turn.characterReplyText,
        audioUrl: turn.audioUrl,
        sceneEnd: turn.sceneEnd,
      };
    },
    [scene.id, sessionId],
  );

  const handleMissionContinue = useCallback(() => {
    // '이야기 계속하기' — 팝업 닫고 보류한 캐릭터 반응 재생 → ⑦ 종료 조건 흐름 재개
    setActiveMission(null);
    const held = heldReplyRef.current;
    heldReplyRef.current = null;
    if (!held) return;
    if (held.characterReplyText) {
      setHistory((h) => [...h, { speaker: 'character', text: held.characterReplyText }]);
    }
    pendingSceneEndRef.current = held.sceneEnd ? held.sceneEnd.nextSceneId : undefined;
    useTurnStore.getState().characterSpeaking(); // SUBMITTED → CHAR_SPEAKING
    playCharacterAudio(held.audioUrl);
  }, [playCharacterAudio]);

  // --- 장면 진입/전환 ---

  useEffect(() => {
    useTurnStore.getState().reset();
    pendingSceneEndRef.current = undefined;
    heldReplyRef.current = null;
    setActiveMission(null);
    setTurnRetry(null);
    setStatusMessage(null);
    // 세션 페이로드 텍스트 우선 — 서버가 고른 오디오(실명본/폴백)와 표기가 일치한다
    const opening =
      scene.openingText ??
      substituteChildName(fixtureScenes.find((s) => s.scene_order === scene.order)?.character_opening ?? '', childName);
    setHistory(opening ? [{ speaker: 'character', text: opening }] : []);
    playCharacterAudio(scene.openingAudioUrl ?? null);
    const audio = audioRef.current;
    const hint = hintAudioRef.current;
    return () => {
      audio?.pause();
      hint?.pause();
      useTurnStore.getState().reset();
    };
    // 장면 단위로만 초기화 — 콜백 아이덴티티 변경은 재진입 사유가 아니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [history]);

  const currentLine = [...history].reverse().find((b) => b.speaker === 'character')?.text ?? '';
  // 이전 대화 목록 (T076, E2E 항목 15) — 캐릭터 대사 카드에 떠 있는 현재 대사는 목록에서 뺀다
  const lastCharacterIndex = history.findLastIndex((b) => b.speaker === 'character');
  const pastBubbles = history.filter((_, i) => i !== lastCharacterIndex);
  const badgeLabel = PHASE_LABELS[phase];
  // REVIEW에서도 마이크 활성 — 보내기 전 재녹음 허용 (T072, E2E 항목 13)
  const micEnabled = (phase === 'RECORDING' || phase === 'REVIEW') && recorder.status !== 'requesting';
  const sendEnabled = phase === 'REVIEW' && !!sttText?.trim();

  return (
    // 태블릿 가로·PC(lg+)는 좌=현재 턴 / 우=이전 대화 목록 2단, 좁은 화면은 세로 스택 (T076)
    <section className="flex min-h-0 flex-1 flex-col items-center gap-3 px-6 pb-6 lg:flex-row lg:items-stretch lg:justify-center lg:gap-6">
      <audio ref={audioRef} hidden />
      <audio ref={hintAudioRef} hidden />

      {/* 미션 오버레이 (T042) — 화면 전환 없는 단일 팝업, 서버 exposeMission으로만 열림 */}
      {activeMission && (
        <MissionPopup
          missionId={activeMission}
          sceneId={fixtureScene?.external_id ?? scene.id}
          onSubmit={handleMissionSubmit}
          onContinue={handleMissionContinue}
        />
      )}

      {/* 왼쪽 — 현재 턴 (E2E 항목 15: 최신 대사 출력은 현행 유지) */}
      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-3 lg:max-w-2xl">
      {scene.imageUrl && (
        <img src={scene.imageUrl} alt="" className="max-h-[28vh] w-full max-w-2xl rounded-3xl object-contain" />
      )}

      {/* 캐릭터 대사 카드 — 이름·이미지·대사·다시 듣기 */}
      <div className="flex w-full max-w-2xl items-start gap-4 rounded-3xl bg-white p-4 shadow">
        {scene.characterImageUrl && (
          <img src={scene.characterImageUrl} alt="" className="size-16 shrink-0 rounded-full object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg text-primary">{scene.characterName}</p>
          <p className="text-xl leading-relaxed text-ink">{currentLine}</p>
        </div>
        <button
          type="button"
          onClick={replayAudio}
          disabled={!lastAudioUrl}
          aria-label="다시 듣기"
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-sunny text-2xl active:bg-ink disabled:opacity-40"
        >
          🔊
        </button>
      </div>

      {/* 상태 배지 3종 / 처리 중 로딩(라벨 없음) / 안내 문구 */}
      <div className="flex min-h-12 items-center gap-3">
        {badgeLabel ? (
          <span className="flex h-12 items-center gap-2 rounded-full bg-sunny px-5 text-lg font-semibold text-ink">
            <span aria-hidden>{PHASE_ICONS[phase]}</span>
            {badgeLabel}
          </span>
        ) : phase === 'SUBMITTED' && !turnRetry ? (
          <span className="animate-pulse text-2xl text-ink" role="status" aria-label="캐릭터가 생각하는 중">
            ● ● ●
          </span>
        ) : null}
        {statusMessage && <span className="text-lg font-semibold text-primary">{statusMessage}</span>}
        {recorder.error && !statusMessage && (
          <span className="text-lg font-semibold text-primary">{recorder.error}</span>
        )}
        {turnRetry && (
          <>
            <span className="text-lg text-ink">생각을 정리하는 중이에요...</span>
            <button
              type="button"
              onClick={() => void requestTurn(turnRetry.text, turnRetry.sttRawText)}
              className="h-12 rounded-full bg-primary px-5 text-lg font-bold text-white active:bg-ink"
            >
              다시 보내기
            </button>
          </>
        )}
      </div>

      {/* STT 미리보기 — 수정 불가, 표시 완료 시 보내기 활성 */}
      {phase === 'REVIEW' && sttText && (
        <p className="w-full max-w-2xl rounded-2xl border-2 border-primary bg-white px-4 py-3 text-center text-xl text-ink">
          “{sttText}”
        </p>
      )}

      <div className="min-h-0 flex-1" aria-hidden /> {/* 버튼을 하단으로 밀착 — 내역이 왼쪽 열을 밀지 않게 */}

      {/* 마이크·보내기 — 터치 48px+, 색+아이콘+텍스트 병행 */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleMicClick}
          disabled={!micEnabled}
          style={recorder.isRecording ? { transform: `scale(${1 + Math.min(recorder.level * 2, 0.15)})` } : undefined}
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
      </div>

      {/* 오른쪽 — 이전 대화 목록 (T076, 기능명세서 2.4.3 대화 내역 리스트 필수).
          화면 스크롤 미허용 원칙과의 조화: 목록 영역 내부 스크롤만 허용 */}
      <aside
        aria-label="이전 대화 내역"
        className="flex max-h-40 w-full max-w-2xl min-h-0 flex-col gap-2 overflow-y-auto rounded-3xl bg-white/50 p-3 lg:max-h-none lg:w-80 lg:flex-none"
      >
        <p className="font-display text-lg text-ink">지금까지 나눈 이야기</p>
        {pastBubbles.length === 0 && (
          <p className="text-base text-ink/50">대화를 시작하면 여기에 쌓여요</p>
        )}
        {pastBubbles.map((bubble, i) => (
          <p
            key={i}
            className={
              bubble.speaker === 'child'
                ? 'ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-lg text-white'
                : 'mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-white px-4 py-2 text-lg text-ink shadow-sm'
            }
          >
            {bubble.text}
          </p>
        ))}
        <div ref={historyEndRef} />
      </aside>
    </section>
  );
}
