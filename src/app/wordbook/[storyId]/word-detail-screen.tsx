'use client';
// 개별 단어장 본체 (T083, 피그마 2.6 단어장_개별단어장_단어1~5) — 좌측 단어 리스트(선택 상태 5종의
// 프레임을 클라이언트 선택 상태로 구현) + 우측 단어 상세(일러스트·뜻·이야기 속 문장·소리내어 듣기).
// 시안 실측: 리스트 아이템 h95 r16(선택 시 bg #FFF0E8 + primary 3px 보더)·단어 fs24·셰브런 44 원형 /
// 상세 카드 r24 pad 15,32 · 일러스트 181² · 단어 fs26 primary · 뜻 fs24 · 배지 bg #FFF8E0 r40 ·
// 인용 fs18 lh29(강조 단어 bg #FFF0E8 primary) · 소리내어 듣기 166×48 r40 남색 그라데이션(#2D3A5E→#3D4E7A).
// 소리내어 듣기 = 사전 생성 mp3(fixed-audio 버킷, 단어+뜻 — tts-lines kind=wordbook) 재생.
// 하단 CTA '단어 게임 하러가기' → 퀴즈(2.6 퀴즈1). 아이 화면 — 한 화면 수납, 부족 시 본문 스크롤.
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { withChild } from '@/components/bottom-nav';
import { fixedAudioUrl } from '@/lib/fixed-audio';
import { WORDBOOK_STORY_ID, wordAudioKey, wordImageUrl, wordbookWords } from '@/lib/wordbook';

/** 인용문에서 단어(활용형 포함) 강조 — 어간 매칭: '탐스럽다'→'탐스러운'도 칩으로 감싸기 위해 어미 제거 */
function quoteParts(quote: string, word: string): { text: string; highlight: boolean }[] {
  const stem = word.replace(/(하다|스럽다|다)$/, '');
  const target = stem.length >= 2 ? stem : word;
  const index = quote.indexOf(target);
  if (index < 0) return [{ text: quote, highlight: false }];
  // 강조 범위는 어간 + 이어지는 한글(활용 어미)까지 — 시안은 단어 부분만 칩 처리
  let end = index + target.length;
  while (end < quote.length && /[가-힣]/.test(quote[end])) end += 1;
  return [
    { text: quote.slice(0, index), highlight: false },
    { text: quote.slice(index, end), highlight: true },
    { text: quote.slice(end), highlight: false },
  ];
}

export function WordDetailScreen({ childId }: { childId: string | null }) {
  const router = useRouter();
  const words = wordbookWords();
  const [selected, setSelected] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const word = words[selected];

  useEffect(() => {
    return () => audioRef.current?.pause(); // 화면 이탈 시 재생 중단
  }, []);

  const playWord = () => {
    audioRef.current?.pause();
    const audio = new Audio(fixedAudioUrl(wordAudioKey(word)));
    audioRef.current = audio;
    void audio.play().catch(() => {
      // 오디오 미업로드·네트워크 실패 — 화면 유지, 재클릭으로 재시도 (고정 대사 오디오 관례)
    });
  };

  return (
    <div className="flex h-dvh flex-col overflow-y-auto bg-background">
      {/* 뒤로가기 — 시안 44px 흰 원형, 목록 복귀 */}
      <div className="shrink-0 px-5 pt-4">
        <button
          type="button"
          aria-label="단어장 목록으로 돌아가기"
          onClick={() => router.push(withChild('/wordbook', childId))}
          className="flex size-11 items-center justify-center rounded-full bg-white shadow-[0_3px_10px_rgba(0,0,0,0.25)] active:opacity-70"
        >
          <svg width="10" height="20" viewBox="0 0 10 20" fill="none" aria-hidden>
            <path d="M9 1 1 10l8 9" stroke="#3A2C1E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <main className="mx-auto flex w-full max-w-[1194px] flex-1 flex-col px-8 pt-4 pb-8">
        <header className="shrink-0">
          <h1 className="font-display text-[32px] leading-tight text-ink">방귀 뀌는 며느리</h1>
          <p className="mt-1 font-display text-xl text-[#8A7A68]">이야기를 들으며 모은 단어들이에요!</p>
        </header>

        <div className="mt-6 flex min-h-0 flex-1 gap-4">
          {/* 좌측 단어 리스트 — 선택 아이템만 primary 보더 + #FFF0E8 (시안 단어1~5 프레임) */}
          <ul className="flex max-h-[432px] w-[44%] shrink-0 flex-col gap-2.5 overflow-y-auto pr-1" role="listbox" aria-label="단어 목록">
            {words.map((item, index) => {
              const isSelected = index === selected;
              return (
                <li key={item.external_id} className="shrink-0">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelected(index)}
                    className={`flex h-[95px] w-full items-center justify-between rounded-2xl px-6 shadow-[0_2px_8px_rgba(58,44,30,0.07)] active:opacity-80 ${
                      isSelected ? 'border-[3px] border-primary bg-[#FFF0E8]' : 'bg-white'
                    }`}
                  >
                    <span className="truncate font-display text-2xl text-ink">{item.word}</span>
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.25)]">
                      <svg width="10" height="20" viewBox="0 0 10 20" fill="none" aria-hidden>
                        <path d="M1 1l8 9-8 9" stroke="#3A2C1E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* 우측 단어 상세 카드 */}
          <div className="flex min-w-0 flex-1 flex-col">
            <section className="flex flex-1 flex-col rounded-3xl bg-white px-8 py-4 shadow-[0_4px_20px_rgba(58,44,30,0.10)]">
              <div className="relative mx-auto size-[181px] shrink-0">
                <Image src={wordImageUrl(word)} alt="" fill sizes="181px" className="object-contain" />
              </div>
              <p className="mt-2 font-display text-2xl leading-relaxed text-ink">
                <span className="text-[26px] text-primary">{word.word}</span>
                <span> : </span>
                {word.definition}
              </p>
              <span className="mt-3 flex w-fit items-center gap-1.5 rounded-full bg-[#FFF8E0] px-4 py-1.5">
                {/* 책+체크 배지 아이콘 (시안 Book_check) */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M5 4h11a2 2 0 0 1 2 2v13H7a2 2 0 0 1-2-2V4z" stroke="#FF7A3D" strokeWidth="2" strokeLinejoin="round" />
                  <path d="m9 10 2 2 3.5-4" stroke="#FF7A3D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="font-display text-lg text-[#8A7A68]">이야기 속에 나왔던 말</span>
              </span>
              <p className="mt-2.5 font-display text-lg leading-[29px] text-ink">
                “
                {quoteParts(word.story_quote, word.word).map((part, i) =>
                  part.highlight ? (
                    <mark key={i} className="rounded-md bg-[#FFF0E8] px-1.5 text-primary">
                      {part.text}
                    </mark>
                  ) : (
                    <span key={i}>{part.text}</span>
                  ),
                )}
                ”
              </p>
              <button
                type="button"
                onClick={playWord}
                className="mx-auto mt-auto mb-1 flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-[#2D3A5E] to-[#3D4E7A] px-5 font-display text-lg text-white shadow-[0_3px_14px_rgba(58,44,30,0.10)] active:opacity-85"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-white/15">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M2 6v4h3l4 3V3L5 6H2z" fill="#fff" />
                    <path d="M11.5 5.5a3.5 3.5 0 0 1 0 5M13.5 3.5a6.2 6.2 0 0 1 0 9" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </span>
                소리내어 듣기
              </button>
            </section>

            {/* CTA — 단어 게임(퀴즈 2.6) */}
            <Link
              href={withChild(`/wordbook/${WORDBOOK_STORY_ID}/quiz`, childId)}
              className="mt-4 flex h-[55px] shrink-0 items-center justify-center rounded-full bg-primary font-display text-xl font-bold text-white shadow-[0_5px_10px_rgba(255,122,61,0.33)] active:opacity-90"
            >
              단어 게임 하러가기
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
