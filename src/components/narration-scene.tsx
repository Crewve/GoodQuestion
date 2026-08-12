'use client';
// 도입/전개 내레이션 화면 (T036, 기능명세서 2.4.1·2.4.2) — scene_description 온점 분리 문장을
// 한 문장씩 노출·자동 재생. 문장 종료 시 자동 전환 없음(화살표로만 진행), 첫 문장은 이전 화살표 미노출,
// 마지막 문장은 다음 화살표 대신 '진행하기'. 오디오는 문장별 사전 생성본(pregenerate-audio `_s{i}` 파일).
// 재생 실패 시 별도 에러 없이 텍스트만 노출하고 '다시 듣기'가 재시도를 겸한다 (TTS 폴백 매트릭스).
// 마크업은 피그마 「개발 배포용」 2.4.1 도입/전개 프레임 대조: 장면 일러스트(라운드 20)
// → 자막 카드(웨이브 배지+문장, 좌 흰 화살표/우 잉크 화살표) → 하단 다시 듣기(sage)·진행하기(primary).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { narrationSentenceAudioUrl, splitNarrationSentences } from '@/lib/narration';

type NarrationSceneProps = {
  description: string;
  imageUrl?: string;
  /** /api/sessions scenes[].openingAudioUrl (장면 전체 내레이션 mp3) — 문장별 URL 파생 기준 */
  narrationAudioUrl?: string;
  /** 마지막 문장 버튼 라벨 (기본 '진행하기') */
  proceedLabel?: string;
  onProceed: () => void;
};

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden fill="none">
      <path
        d={direction === 'left' ? 'M14.5 5.5L8 12l6.5 6.5' : 'M9.5 5.5L16 12l-6.5 6.5'}
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 자막 카드 스피커 배지 — 시안 WaveIcon (6개 세로 바, #FF651E) */
function WaveBadge() {
  const bars = [6, 12, 16, 9, 13, 6];
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 shadow-[0_0_0_6px_rgba(255,122,61,0.15)]"
    >
      <svg viewBox="0 0 20 16" className="h-4 w-5">
        {bars.map((h, i) => (
          <rect key={i} x={i * 3.6} y={(16 - h) / 2} width="2.2" height={h} rx="1.1" fill="#ff651e" />
        ))}
      </svg>
    </span>
  );
}

/** 다시 듣기 반복 화살표 아이콘 — 시안 repeat (흰 스트로크) */
function RepeatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 2l4 4-4 4" />
      <path d="M3 12v-2a4 4 0 0 1 4-4h14" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 12v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function NarrationScene({
  description,
  imageUrl,
  narrationAudioUrl,
  proceedLabel = '진행하기',
  onProceed,
}: NarrationSceneProps) {
  const sentences = useMemo(() => splitNarrationSentences(description), [description]);
  const [index, setIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isLast = index === sentences.length - 1;

  const playCurrent = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !narrationAudioUrl) return;
    audio.src = narrationSentenceAudioUrl(narrationAudioUrl, index);
    audio.currentTime = 0;
    // 실패(자동재생 차단·파일 부재)는 조용히 무시 — 텍스트는 이미 노출, '다시 듣기'가 재시도 경로
    void audio.play().catch(() => undefined);
  }, [index, narrationAudioUrl]);

  // 진입·문장 전환 시 자동 재생, 언마운트/전환 시 이전 재생 중단
  useEffect(() => {
    playCurrent();
    const audio = audioRef.current;
    return () => audio?.pause();
  }, [playCurrent]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <audio ref={audioRef} hidden />

      {/* 장면 일러스트 — 시안 1154×592, 좌우 20px 여백·라운드 20 */}
      <div className="min-h-0 flex-1 px-5">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full rounded-[20px] bg-[#ffe8c9] object-cover" />
        ) : (
          <div className="h-full w-full rounded-[20px] bg-[#ffe8c9]" aria-hidden />
        )}
      </div>

      {/* 자막 행 — 이전(흰)/다음(잉크) 화살표 + 문장 카드 */}
      <div className="flex min-h-24 shrink-0 items-center gap-3 px-5 py-2.5">
        {/* 첫 문장에서는 이전 화살표 자체를 노출하지 않는다 (2.4.1) — 자리는 유지해 레이아웃 고정 */}
        {index > 0 ? (
          <button
            type="button"
            aria-label="이전 문장"
            onClick={() => setIndex(index - 1)}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-[0_3px_10px_rgba(0,0,0,0.25)] active:bg-ink active:text-white"
          >
            <ChevronIcon direction="left" />
          </button>
        ) : (
          <span className="size-12 shrink-0" aria-hidden />
        )}

        <div className="flex min-h-[72px] min-w-0 flex-1 items-center gap-3.5 rounded-2xl border border-primary/15 bg-white px-[18px] py-3 shadow-[0_2px_12px_rgba(0,0,0,0.07)]">
          <WaveBadge />
          <p className="min-w-0 flex-1 font-display text-[22px] leading-[30px] text-ink">
            {sentences[index] ?? ''}
          </p>
        </div>

        {/* 마지막 문장은 다음 화살표 대신 하단 '진행하기'로 진행 — 자리는 유지해 레이아웃 고정 */}
        {!isLast ? (
          <button
            type="button"
            aria-label="다음 문장"
            onClick={() => setIndex(index + 1)}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-white shadow-[0_3px_10px_rgba(0,0,0,0.25)] active:bg-primary"
          >
            <ChevronIcon direction="right" />
          </button>
        ) : (
          <span className="size-12 shrink-0" aria-hidden />
        )}
      </div>

      {/* 하단 버튼 — 다시 듣기(sage) 항상, 진행하기(primary)는 마지막 문장에서만 */}
      <div className="flex h-[88px] shrink-0 items-center justify-center gap-[30px] px-5 pb-4">
        <button
          type="button"
          onClick={playCurrent}
          className="flex h-14 items-center gap-1.5 rounded-full border border-base bg-sage px-5 font-display text-2xl text-white shadow-[0_1px_4px_rgba(0,0,0,0.07)] active:bg-ink"
        >
          <RepeatIcon />
          다시 듣기
        </button>
        {isLast && (
          <button
            type="button"
            onClick={onProceed}
            className="flex h-14 items-center rounded-full border border-base bg-primary px-8 font-display text-2xl text-white shadow-[0_1px_4px_rgba(0,0,0,0.07)] active:bg-ink"
          >
            {proceedLabel}
          </button>
        )}
      </div>
    </section>
  );
}
