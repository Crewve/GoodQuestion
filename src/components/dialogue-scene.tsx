'use client';
// 대화 장면 (T037, 기능명세서 2.4.3) — 턴 사이클 UI. 상태 전이는 turn 스토어(T033)가 소유하고
// 이 컴포넌트는 오디오·녹음·API 이벤트만 배선한다:
// 캐릭터 대사 자동 재생 → 재생 종료 시 녹음 자동 시작 → 마이크 버튼으로 종료 → 사전 게이트 → /api/stt
// → REVIEW(수정 불가 미리보기) → 보내기 클릭 시에만 /api/turn → 응답 재생 → 반복.
// CLOSING(sceneEnd) 응답은 고정 오디오 재생을 마친 뒤 onSceneEnd 호출 — 장면 전환은 컨테이너(T038) 몫.
// 폴백(contracts 매트릭스): 게이트/STT 실패 = "다시 한번 말해줄래?" + 마이크 재클릭, 턴 실패 = 다시 보내기,
// audioUrl 없음(TTS 장애) = 텍스트만 표시하고 즉시 다음 단계, 자동재생 차단 = 다시 듣기 탭이 복구 경로.
// 마크업은 피그마 「개발 배포용」 2.4.2 대화 프레임 대조: 좌 장면 일러스트 / 우 라운드 패널
// (캐릭터 상단 → 대사 카드+다시 듣기 칩 → 대화 내역 리스트('내가 한 말' 카드) → 상태 카드(대화 영역)
// → 마이크(원형 76px)·보내기). 상태 카드 색: 듣는 중 #F5EDE0 / 녹음 primary / 변환 sunny.
import { useCallback, useEffect, useRef, useState } from 'react';
import { MissionPopup } from '@/components/mission-popup';
import { useRecorder, type RecordingResult } from '@/hooks/useRecorder';
import { avatarUrl, type AvatarKey } from '@/lib/assets';
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
  /** 상태 카드 미니 프로필용 아이 아바타 (피그마 2.4.2) — 미전달 시 캐릭터 프로필 폴백 */
  childAvatarKey?: string | null;
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

/** 아이 격려 고정 문구 — 시안 상태 카드(대화 영역) 하단 공통 표기 */
const ENCOURAGEMENT = '질문이 많은 친구는 새로운 생각을 찾을 수 있어요.';

function SpeakerIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M4 9v6h4l5 4.5v-15L8 9H4z" />
      <path d="M15.8 8.6a4.6 4.6 0 0 1 0 6.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M18 6.2a8 8 0 0 1 0 11.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** 녹음 중 웨이브 아이콘 — 시안 WaveIcon (6개 세로 바) */
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

/** 변환 중 스피너 — 시안 SpinIcon (원호 스트로크) */
function SpinnerIcon({ className = 'size-[26px]' }: { className?: string }) {
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

function MicIcon({ className = 'size-[26px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <rect x="9" y="1.5" width="6" height="12.5" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12 18v4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DialogueScene({ sessionId, scene, childName, childAvatarKey, onSceneEnd }: DialogueSceneProps) {
  const childAvatarSrc =
    childAvatarKey && (['boy-1', 'boy-2', 'girl-1', 'girl-2'] as const).includes(childAvatarKey as AvatarKey)
      ? avatarUrl(childAvatarKey as AvatarKey)
      : null;
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

  // 상태 카드(대화 영역) 톤 — 시안: 듣는 중 #F5EDE0/#8A7A68, 녹음 primary/white, 변환 sunny/ink
  const statusTone =
    phase === 'RECORDING'
      ? 'bg-primary text-white'
      : phase === 'TRANSCRIBING'
        ? 'bg-sunny text-ink'
        : 'bg-[#f5ede0] text-[#8a7a68]';

  return (
    // 시안 StoryDialogueScreen: 좌 장면 일러스트 / 우 라운드 대화 패널 (좁은 화면은 세로 스택, 내부 스크롤만 허용)
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] bg-[#ffe8c9] lg:flex-row lg:gap-1.5">
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

      {/* 좌 — 장면 일러스트 (시안 640/1194 전면 배치) */}
      <div className="h-[24%] w-full shrink-0 lg:h-auto lg:min-h-0 lg:w-[53%] lg:flex-none">
        {scene.imageUrl ? (
          <img src={scene.imageUrl} alt="" className="h-full w-full object-contain object-top" />
        ) : (
          <div className="h-full w-full bg-[#ffe8c9]" aria-hidden />
        )}
      </div>

      {/* 우 — 대화 패널 (라운드 50·primary 보더) */}
      <div className="mx-2 mb-2 flex min-h-0 min-w-0 flex-1 flex-col rounded-[32px] border border-primary bg-background p-4 shadow-[0_4px_15px_rgba(255,122,61,0.22)] lg:mx-0 lg:mb-[9px] lg:rounded-[50px] lg:p-5">
        {/* 캐릭터 상단 — 프로필·이름 */}
        <div className="flex shrink-0 items-center gap-3">
          {scene.characterImageUrl && (
            <img src={scene.characterImageUrl} alt="" className="size-14 shrink-0 rounded-full object-cover lg:size-[84px]" />
          )}
          <p className="min-w-0 truncate font-display text-2xl text-ink lg:text-[28px]">{scene.characterName}</p>
        </div>

        {/* 캐릭터 대사 카드 — 대사 + 다시 듣기 칩 */}
        <div className="mt-3 shrink-0 border border-[#f0e4d3] bg-white px-5 py-4 shadow-[0_4px_18px_rgba(58,44,30,0.08)]">
          <p className="font-display text-[22px] leading-8 text-ink">{currentLine}</p>
          <div className="mt-1.5 flex justify-end">
            <button
              type="button"
              onClick={replayAudio}
              disabled={!lastAudioUrl}
              className="flex h-12 items-center gap-1.5 rounded-lg bg-[#fff5d4] px-3 text-lg font-bold text-ink active:bg-sunny disabled:opacity-40"
            >
              <SpeakerIcon />
              다시 듣기
            </button>
          </div>
        </div>

        {/* 대화 내역 리스트 (T076, 기능명세서 2.4.3 필수) — 화면 스크롤 미허용 원칙과의 조화: 내부 스크롤만 허용 */}
        <div aria-label="이전 대화 내역" className="my-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {pastBubbles.map((bubble, i) =>
            bubble.speaker === 'child' ? (
              <div
                key={i}
                className="rounded-[20px] rounded-tr-none border border-sky/25 bg-[#ddf0fb]/80 px-5 py-3.5 shadow-[0_4px_18px_rgba(58,44,30,0.08)]"
              >
                <p className="text-lg font-bold text-sky">내가 한 말</p>
                <p className="mt-1 font-display text-[22px] leading-8 text-ink">{bubble.text}</p>
              </div>
            ) : (
              <div
                key={i}
                className="rounded-[20px] rounded-tl-none border border-[#f0e4d3] bg-white/80 px-5 py-3.5 shadow-[0_4px_18px_rgba(58,44,30,0.08)]"
              >
                <p className="text-lg font-bold text-primary">{scene.characterName ?? '캐릭터'}의 말</p>
                <p className="mt-1 font-display text-[22px] leading-8 text-ink">{bubble.text}</p>
              </div>
            ),
          )}

          {/* STT 미리보기 — 수정 불가, '내가 한 말' 카드 표기 (시안 대화 내역 리스트), 표시 완료 시 보내기 활성 */}
          {phase === 'REVIEW' && sttText && (
            <div className="rounded-[20px] rounded-tr-none border-2 border-sky bg-[#ddf0fb] px-5 py-3.5">
              <p className="text-lg font-bold text-sky">내가 한 말</p>
              <p className="mt-1 font-display text-[22px] leading-8 text-ink">“{sttText}”</p>
            </div>
          )}
          <div ref={historyEndRef} />
        </div>

        {/* 상태 카드(대화 영역) — 미니 프로필(피그마: 아이 아바타, 폴백 캐릭터) + 상태 3종/처리 중/안내·재시도 */}
        <div className="relative mt-1 shrink-0 pl-[70px] lg:pl-[90px]">
          {(childAvatarSrc || scene.characterImageUrl) && (
            <img
              src={childAvatarSrc ?? scene.characterImageUrl}
              alt=""
              className="absolute top-1/2 left-0 size-20 -translate-y-1/2 rounded-full border border-primary bg-[#ffede3] object-cover shadow-[0_4px_15px_rgba(255,122,61,0.33)] lg:size-[96px]"
            />
          )}
          <div className={`flex min-h-[76px] flex-col justify-center rounded-2xl px-4 py-2.5 ${statusTone}`}>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              {badgeLabel ? (
                <>
                  <span aria-hidden>
                    {phase === 'RECORDING' ? (
                      <WaveBarsIcon />
                    ) : phase === 'TRANSCRIBING' ? (
                      <SpinnerIcon />
                    ) : (
                      <SpeakerIcon className="size-6" />
                    )}
                  </span>
                  <p className="font-display text-lg">{badgeLabel}</p>
                </>
              ) : phase === 'SUBMITTED' && !turnRetry ? (
                <span className="animate-pulse font-display text-lg" role="status" aria-label="캐릭터가 생각하는 중">
                  ● ● ●
                </span>
              ) : null}
              {statusMessage && <span className="text-lg font-bold">{statusMessage}</span>}
              {recorder.error && !statusMessage && <span className="text-lg font-bold">{recorder.error}</span>}
              {turnRetry && (
                <>
                  <span className="text-lg">생각을 정리하는 중이에요...</span>
                  <button
                    type="button"
                    onClick={() => void requestTurn(turnRetry.text, turnRetry.sttRawText)}
                    className="h-12 rounded-full bg-primary px-5 font-display text-lg text-white active:bg-ink"
                  >
                    다시 보내기
                  </button>
                </>
              )}
            </div>
            {!turnRetry && !statusMessage && !recorder.error && (
              <p className="mt-0.5 font-display text-lg opacity-75">{ENCOURAGEMENT}</p>
            )}
          </div>
        </div>

        {/* 마이크(원형 76px)·보내기 — 터치 48px+, 상태는 색+아이콘+상태 카드 텍스트 병행 */}
        <div className="flex min-h-[76px] shrink-0 items-center justify-center gap-6 pt-3">
          <button
            type="button"
            onClick={handleMicClick}
            disabled={!micEnabled}
            aria-label={recorder.isRecording ? '말 끝났어요 — 녹음 끝내기' : phase === 'REVIEW' ? '다시 말하기' : '눌러서 말하기'}
            style={recorder.isRecording ? { transform: `scale(${1 + Math.min(recorder.level * 2, 0.15)})` } : undefined}
            className={`flex size-[76px] shrink-0 items-center justify-center rounded-full text-white transition-transform ${
              phase === 'TRANSCRIBING' ? 'bg-sunny shadow-[0_8px_28px_rgba(255,201,60,0.33)]' : 'bg-primary shadow-[0_8px_28px_rgba(255,122,61,0.33)]'
            } disabled:opacity-40`}
          >
            {recorder.isRecording ? <WaveBarsIcon /> : phase === 'TRANSCRIBING' ? <SpinnerIcon /> : <MicIcon />}
          </button>
          {/* 시안: 녹음·변환 중에는 마이크 단독 센터 — 그 외에는 보내기 병행 */}
          {phase !== 'RECORDING' && phase !== 'TRANSCRIBING' && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!sendEnabled}
              className="h-12 rounded-full bg-sage px-5 font-display text-xl text-white active:bg-ink disabled:opacity-40"
            >
              보내기 →
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
