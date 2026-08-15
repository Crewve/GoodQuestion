'use client';
// 단어 게임(빈칸 퀴즈) 본체 (T083, 피그마 2.6 단어장_퀴즈1~5 + _선택/_정답/_오답/_마지막 상태) —
// 5문항 고정, 보기 클릭 즉시 선택 표시 + 정답/오답 팝업(시안에 별도 확인 버튼 없음).
// 시안 실측: 헤더 h80 bg Base(나가기 필 135×48 r32 · 진행 n/5 fs22 + 바 174×24 r50 primary 채움) /
// 본문 bg #FFE8C9 · 흰 카드 r30(장면 이미지 350×262 r10 · 힌트 듣기 칩 bg #DDF5EC sage ·
// 문제 fs22 lh29 · 보기 h54 bg #F8F6F1 r14, 선택 시 bg #FFF0E6 + primary 2px 보더 + 체크 라디오) /
// 팝업 510 r32(정답: sage 링 + "딩동댕! 정답이에요" / 오답: primary X + "정답은 {단어}예요!" +
// 뜻 상자 bg #FCEAD1/50 / 마지막 문제: "마지막 문제까지 다 풀었어요" + CTA "퀴즈 끝내기").
// 힌트 듣기 = 정답을 채운 원문 문장 사전 생성 mp3(fixed-audio, tts-lines kind=wordbook) 재생.
// 나가기·퀴즈 끝내기 → 개별 단어장 복귀. 아이 화면 — 한 화면 수납.
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { withChild } from '@/components/bottom-nav';
import { fixedAudioUrl } from '@/lib/fixed-audio';
import {
  WORDBOOK_STORY_ID,
  quizHintAudioKey,
  quizQuestionDisplay,
  quizSceneImageUrl,
  wordbookQuiz,
} from '@/lib/wordbook';

export function QuizScreen({ childId }: { childId: string | null }) {
  const router = useRouter();
  const quiz = wordbookQuiz();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const item = quiz[index];
  const isLast = index === quiz.length - 1;
  const answered = selected !== null;
  const isCorrect = selected === item.answer_index;

  useEffect(() => {
    return () => audioRef.current?.pause();
  }, []);

  const stopAudio = () => audioRef.current?.pause();

  const playHint = () => {
    stopAudio();
    const audio = new Audio(fixedAudioUrl(quizHintAudioKey(item)));
    audioRef.current = audio;
    void audio.play().catch(() => {
      // 오디오 미업로드·네트워크 실패 — 화면 유지, 재클릭 재시도
    });
  };

  const exitToWordbook = () => {
    stopAudio();
    router.push(withChild(`/wordbook/${WORDBOOK_STORY_ID}`, childId));
  };

  const goNext = () => {
    stopAudio();
    if (isLast) {
      exitToWordbook(); // 퀴즈 끝내기 → 개별 단어장 복귀
      return;
    }
    setSelected(null);
    setIndex((i) => i + 1);
  };

  const answerWord = item.choices[item.answer_index];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-[#FFE8C9]">
      {/* 헤더 — 이야기 진행 헤더 재사용 시안: bg Base h80, 나가기 필 + 진행률 */}
      <header className="flex h-20 shrink-0 items-center justify-between bg-background px-6">
        <button
          type="button"
          onClick={exitToWordbook}
          className="flex h-12 items-center gap-2.5 rounded-full bg-white px-5 shadow-[0_3px_10px_rgba(0,0,0,0.25)] active:opacity-70"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <path d="M2 2l12 12M14 2 2 14" stroke="#3A2C1E" strokeWidth="3.2" strokeLinecap="round" />
          </svg>
          <span className="font-display text-2xl text-ink">나가기</span>
        </button>
        <div className="flex items-center gap-4">
          <span className="font-display text-[22px] text-[#8A7A68]">
            {index + 1}/{quiz.length}
          </span>
          <div
            className="h-6 w-[174px] overflow-hidden rounded-full bg-[#8A7A68]/12"
            role="progressbar"
            aria-valuenow={index + 1}
            aria-valuemin={1}
            aria-valuemax={quiz.length}
          >
            <div className="h-full rounded-sm bg-primary" style={{ width: `${((index + 1) / quiz.length) * 100}%` }} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1194px] min-h-0 flex-1 px-[57px] py-5">
        <div className="flex min-h-0 w-full flex-col items-center overflow-y-auto rounded-[30px] bg-white px-6 py-6 shadow-[0_4px_15px_rgba(0,0,0,0.20)]">
          {/* 장면 이미지 — 문제가 나온 이야기 장면 재사용 */}
          <div className="relative h-[228px] w-[305px] shrink-0 overflow-hidden rounded-[10px] shadow-[0_10px_10px_rgba(58,44,30,0.25)]">
            <Image src={quizSceneImageUrl(item)} alt="" fill sizes="350px" loading="eager" className="object-cover" />
          </div>

          <button
            type="button"
            onClick={playHint}
            className="mt-3 flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#DDF5EC] px-3.5 active:opacity-75"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="9" fill="#3DBE8B" />
              <path d="M10 8.5v7l5.5-3.5L10 8.5z" fill="#fff" />
            </svg>
            <span className="font-display text-lg text-sage">힌트 듣기</span>
          </button>

          <p className="mt-2 max-w-[520px] shrink-0 text-center font-display text-[22px] leading-[29px] text-ink">
            &quot;{quizQuestionDisplay(item)}&quot;
          </p>

          {/* 보기 4개 — 클릭 즉시 채점, 팝업 노출 (시안에 확인 단계 없음) */}
          <div className="mt-3 flex w-full max-w-[520px] flex-col gap-2.5">
            {item.choices.map((choice, choiceIndex) => {
              const isSelected = answered && choiceIndex === selected;
              return (
                <button
                  key={choice}
                  type="button"
                  disabled={answered}
                  onClick={() => setSelected(choiceIndex)}
                  className={`flex h-[54px] shrink-0 items-center gap-3 rounded-[14px] px-[18px] text-left ${
                    isSelected ? 'border-2 border-primary bg-[#FFF0E6]' : 'bg-[#F8F6F1] active:bg-[#FFF0E6]'
                  }`}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                      isSelected ? 'bg-primary' : 'border-[1.5px] border-[#D9D1C2] bg-white'
                    }`}
                  >
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                        <path d="m2 6.5 2.6 2.6L10 3.5" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    )}
                  </span>
                  <span className="font-display text-xl text-ink">
                    {choiceIndex + 1}. {choice}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* 정답/오답 팝업 — 시안 510 r32, 오버레이 ink 45% */}
      {answered && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 p-4" role="dialog" aria-modal>
          <div className="flex w-full max-w-[510px] flex-col items-center rounded-[32px] bg-white px-5 pt-10 pb-[60px] shadow-[0_24px_64px_rgba(58,44,30,0.18)]">
            {isCorrect ? (
              <span className="size-[89px] rounded-full border-[12px] border-sage" aria-hidden />
            ) : (
              <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden>
                <path d="M30 30l60 60M90 30l-60 60" stroke="#FF7A3D" strokeWidth="13" strokeLinecap="round" />
              </svg>
            )}

            {isCorrect ? (
              <>
                <p className="mt-6 font-display text-3xl text-sage">딩동댕! 정답이에요</p>
                <p className="mt-1 font-display text-[26px] text-ink">이야기 속 단어를 잘 기억하고 있네요.</p>
              </>
            ) : (
              <>
                <p className="mt-6 font-display text-3xl text-ink">
                  정답은 <span className="text-primary">{answerWord}</span>예요!
                </p>
                <p className="mt-1 font-display text-[26px] text-ink">다시 한 번 배워볼까요?</p>
                <p className="mt-4 rounded-lg bg-[#FCEAD1]/50 px-3.5 py-1.5 font-display text-[22px] text-ink">
                  {/* 설명 원문("{단어}는 …")의 단어 부분만 primary 강조 (시안) */}
                  {item.explanation.startsWith(answerWord) ? (
                    <>
                      <span className="text-primary">{answerWord}</span>
                      {item.explanation.slice(answerWord.length)}
                    </>
                  ) : (
                    item.explanation
                  )}
                </p>
              </>
            )}

            <p className="mt-5 text-center font-display text-xl text-ink whitespace-pre-line">
              {isLast ? '마지막 문제까지 다 풀었어요.\n정말 잘했어요!' : '다음 문제도 풀어볼까요?'}
            </p>

            <button
              type="button"
              onClick={goNext}
              className="mt-5 h-[55px] w-full max-w-[420px] rounded-full bg-primary font-display text-xl font-bold text-white shadow-[0_5px_10px_rgba(255,122,61,0.33)] active:opacity-90"
            >
              {isLast ? '퀴즈 끝내기' : '다음 문제 풀기'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
