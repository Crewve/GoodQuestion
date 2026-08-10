'use client';
// 도입/전개 내레이션 화면 (T036, 기능명세서 2.4.1·2.4.2) — scene_description 온점 분리 문장을
// 한 문장씩 노출·자동 재생. 문장 종료 시 자동 전환 없음(화살표로만 진행), 첫 문장은 이전 화살표 미노출,
// 마지막 문장은 다음 화살표 대신 '진행하기'. 오디오는 문장별 사전 생성본(pregenerate-audio `_s{i}` 파일).
// 재생 실패 시 별도 에러 없이 텍스트만 노출하고 '다시 듣기'가 재시도를 겸한다 (TTS 폴백 매트릭스).
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

const arrowButtonClass =
  'flex size-14 items-center justify-center rounded-full bg-white text-3xl font-bold text-ink shadow ' +
  'active:bg-ink active:text-white';

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
    <section className="flex flex-1 flex-col items-center justify-between gap-4 px-6 pb-8">
      <audio ref={audioRef} hidden />
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          className="max-h-[45vh] w-full max-w-2xl rounded-3xl object-contain"
        />
      ) : (
        <div className="max-h-[45vh] w-full max-w-2xl flex-1 rounded-3xl bg-white" aria-hidden />
      )}

      <p className="min-h-16 max-w-2xl text-center font-display text-2xl leading-relaxed text-ink">
        {sentences[index] ?? ''}
      </p>

      <div className="flex w-full max-w-2xl items-center justify-between">
        {/* 첫 문장에서는 이전 화살표 자체를 노출하지 않는다 (2.4.1) — 자리는 유지해 레이아웃 고정 */}
        {index > 0 ? (
          <button type="button" aria-label="이전 문장" className={arrowButtonClass} onClick={() => setIndex(index - 1)}>
            ‹
          </button>
        ) : (
          <span className="size-14" aria-hidden />
        )}

        <button
          type="button"
          onClick={playCurrent}
          className="flex h-14 items-center gap-2 rounded-full bg-sunny px-6 text-lg font-semibold text-ink active:bg-ink active:text-white"
        >
          🔊 다시 듣기
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={onProceed}
            className="flex h-14 items-center rounded-full bg-primary px-8 text-lg font-bold text-white active:bg-ink"
          >
            {proceedLabel}
          </button>
        ) : (
          <button type="button" aria-label="다음 문장" className={arrowButtonClass} onClick={() => setIndex(index + 1)}>
            ›
          </button>
        )}
      </div>
    </section>
  );
}
