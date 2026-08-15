'use client';
// 도입/전개 내레이션 화면 (T036, 기능명세서 2.4.1·2.4.2) — scene_description 온점 분리 문장을
// 한 문장씩 노출·자동 재생. 문장 종료 시 자동 전환 없음(화살표로만 진행), 문장 오디오 종료 전에는
// 화살표 비활성(개발 환경 제외 — 수정사항 A2), 첫 문장은 이전 화살표 미노출.
// 진행은 다음 화살표 하나로 통일 (QA 7 — '진행하기' 버튼 삭제): 전개 중에는 다음 문장,
// 마지막 문장에서는 장면 진행. 오디오는 문장별 사전 생성본(pregenerate-audio `_s{i}` 파일).
// 재생 실패 시 별도 에러 없이 텍스트만 노출하고 '다시 듣기'가 재시도를 겸한다 (TTS 폴백 매트릭스).
// 마크업은 피그마 「개발 배포용」 2.4.1 도입/전개 프레임 대조: 장면 일러스트(라운드 20)
// → 자막 카드(웨이브 배지+문장, 좌 흰 화살표/우 잉크 화살표) → 하단 다시 듣기(sage)·진행하기(primary).
// 2026-08-14 피그마 코멘트 반영: 자막 카드가 일러스트를 덮지 않게 분리(#105), 화살표는
// arrow_prev_black/arrow_next_white 에셋(#128·#129), 파형 audio_wave(#130)·반복 repeat(#131),
// 다시 듣기 흰 글자(#91), 마지막 문장에서 '진행하기'(primary·흰 글자) 복원(#91·#106 — 시안 유지 확인).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowNextHeavyIcon, ArrowPrevIcon, AudioWaveIcon, RepeatIcon } from '@/components/icons';
import { narrationSentenceAudioUrl, splitNarrationSentences } from '@/lib/narration';

type NarrationSceneProps = {
  description: string;
  imageUrl?: string;
  /** /api/sessions scenes[].openingAudioUrl (장면 전체 내레이션 mp3) — 문장별 URL 파생 기준 */
  narrationAudioUrl?: string;
  onProceed: () => void;
};

/** 자막 카드 스피커 배지 — audio_wave 에셋(#FF651E Burning Orange) [피그마 코멘트 #130] */
function WaveBadge() {
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[#FF651E] shadow-[0_0_0_6px_rgba(255,122,61,0.15)]"
    >
      <AudioWaveIcon className="h-4 w-5" />
    </span>
  );
}

export function NarrationScene({
  description,
  imageUrl,
  narrationAudioUrl,
  onProceed,
}: NarrationSceneProps) {
  const sentences = useMemo(() => splitNarrationSentences(description), [description]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  /** 자동재생 차단 안내 — 대화 화면과 동일하게 '다시 듣기'가 복구 제스처임을 알린다 (QA 30·33) */
  const [blocked, setBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isLast = index === sentences.length - 1;
  // 문장 오디오 종료 전에는 화살표 잠금 — 개발 환경은 확인 편의상 즉시 넘김 허용
  const locked = isPlaying && process.env.NODE_ENV !== 'development';

  const playCurrent = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !narrationAudioUrl) return;
    audio.src = narrationSentenceAudioUrl(narrationAudioUrl, index);
    audio.currentTime = 0;
    setIsPlaying(true);
    setBlocked(false);
    // 잠금 해제는 재생 미시작으로 남은 때만 — 연타로 이전 play()가 중단된 rejection이 새 재생의 잠금을 풀지 않게
    void audio.play().catch((error: unknown) => {
      if (!audio.paused) return; // 새 재생이 이미 시작됨 — 이전 play()의 중단 rejection
      setIsPlaying(false);
      // 자동재생 차단(이어하기·새로고침 직후 등)은 텍스트만 남아 "소리가 안 난다"로 보인다.
      // 대화 화면(dialogue-scene)과 달리 안내가 없어 복구 경로를 몰랐던 문제 — 안내를 노출한다 (QA 30·33).
      // 파일 부재·디코드 실패는 error 이벤트로 따로 처리되므로 여기서는 차단만 구분한다.
      if ((error as DOMException)?.name === 'NotAllowedError') setBlocked(true);
    });
  }, [index, narrationAudioUrl]);

  // 진입·문장 전환 시 자동 재생, 언마운트/전환 시 이전 재생 중단
  useEffect(() => {
    playCurrent();
    const audio = audioRef.current;
    return () => audio?.pause();
  }, [playCurrent]);

  // 정상 종료(ended)·로드 실패(error) 모두 잠금 해제 — 오디오 없이 텍스트만 남는 폴백에서 진행이 막히지 않게
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const unlock = () => setIsPlaying(false);
    const clearBlocked = () => setBlocked(false); // 재생이 실제로 시작되면 안내 회수
    audio.addEventListener('ended', unlock);
    audio.addEventListener('error', unlock);
    audio.addEventListener('playing', clearBlocked);
    return () => {
      audio.removeEventListener('ended', unlock);
      audio.removeEventListener('error', unlock);
      audio.removeEventListener('playing', clearBlocked);
    };
  }, []);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col">
      <audio ref={audioRef} hidden />

      {/* 장면 일러스트 — 시안 1154×592, 좌우 20px 여백·라운드 20 */}
      <div className="min-h-0 flex-1 px-5">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full rounded-[20px] bg-[#ffe8c9] object-cover object-[50%_55%]" />
        ) : (
          <div className="h-full w-full rounded-[20px] bg-[#ffe8c9]" aria-hidden />
        )}
      </div>

      {/* 자막 행 — 이전(흰)/다음(잉크) 화살표 + 문장 카드.
          일러스트와 겹치지 않게 아래로 분리 (피그마 코멘트 #105 — 최신 시안도 비겹침) */}
      <div className="flex min-h-24 shrink-0 items-center gap-3 px-5 py-2.5">
        {/* 첫 문장에서는 이전 화살표 자체를 노출하지 않는다 (2.4.1) — 자리는 유지해 레이아웃 고정 */}
        {index > 0 ? (
          <button
            type="button"
            aria-label="이전 문장"
            disabled={locked}
            onClick={() => setIndex(index - 1)}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-[0_3px_10px_rgba(0,0,0,0.25)] active:bg-ink active:text-white disabled:opacity-40"
          >
            <ArrowPrevIcon className="size-6" />
          </button>
        ) : (
          <span className="size-12 shrink-0" aria-hidden />
        )}

        <div className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3.5 rounded-2xl border border-primary/15 bg-white px-[18px] py-3 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          <WaveBadge />
          {/* 행간 33px = 1.5배 — 핸드오프 §3 아이 화면 행간 하한 */}
          <p className="min-w-0 flex-1 font-display text-[22px] leading-[33px] text-ink">
            {sentences[index] ?? ''}
          </p>
        </div>

        {/* 다음 화살표가 진행을 전담 (QA 7) — 전개 중에는 다음 문장, 마지막 문장에서는 장면 진행 */}
        <button
          type="button"
          aria-label={isLast ? '다음 장면' : '다음 문장'}
          disabled={locked}
          onClick={() => (isLast ? onProceed() : setIndex(index + 1))}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-[0_3px_10px_rgba(0,0,0,0.25)] active:bg-primary disabled:opacity-40"
        >
          <ArrowNextHeavyIcon className="size-6" />
        </button>
      </div>

      {/* 하단 버튼 — 다시 듣기(sage·흰 글자, #91). 마지막 문장에서는 '진행하기'(primary·흰 글자)가
          함께 노출되어 장면 진행을 담당 (#91·#106 — 시안 복원, 화살표 진행도 유지) */}
      <div className="flex h-[88px] shrink-0 items-center justify-center gap-6 px-5 pb-4">
        {/* 자동재생 차단 안내 — 버튼 줄 위에 겹쳐 띄워 레이아웃(88px 고정)을 흔들지 않는다 */}
        {blocked && (
          <p
            role="status"
            className="pointer-events-none absolute inset-x-0 bottom-[92px] text-center font-display text-xl text-ink"
          >
            🔊 다시 듣기를 눌러 소리를 들어 보자!
          </p>
        )}
        <button
          type="button"
          onClick={playCurrent}
          className={`flex h-14 items-center gap-1.5 rounded-full border border-background bg-sage px-5 font-display text-2xl text-white shadow-[0_1px_4px_rgba(0,0,0,0.07)] active:bg-ink ${
            blocked ? 'ring-4 ring-primary' : '' // 차단 시 복구 버튼을 눈에 띄게
          }`}
        >
          <RepeatIcon className="size-6" />
          다시 듣기
        </button>
        {isLast && (
          <button
            type="button"
            disabled={locked}
            onClick={onProceed}
            className="flex h-14 items-center rounded-full bg-primary px-7 font-display text-2xl text-white shadow-[0_5px_10px_rgba(255,122,61,0.33)] active:opacity-90 disabled:opacity-40"
          >
            진행하기
          </button>
        )}
      </div>
    </section>
  );
}
