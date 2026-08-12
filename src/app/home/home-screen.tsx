'use client';
// 홈 화면 본체 (T048, 기능명세서 2.0) — 인사말(성 제외 이름)·이어하기 카드·추천 3×2·GNB.
// 이어하기: 진행 중 세션이 있을 때만 섹션 노출(서버 판정), 진행률 n/N·%는 T031 /api/sessions 응답 재사용
// (멱등 재개라 세션이 있을 때만 호출 — 없는데 호출하면 세션이 생성되므로 금지).
// 추천 6개: 진행 중 이야기가 없을 때만 1번 카드 '방귀 뀌는 며느리' 고정·유일 클릭 가능(→ 이야기 상세),
// 있으면 더미 6종으로 채운다(2.0 예외 처리 — 더미 썸네일이 6종인 이유). 더미는 클릭 이벤트 미부여.
// Header·GNB는 상하단 고정(핸드오프 §2.1), GNB는 파트2 T049의 BottomNav 공용(단어장 이동 없음,
// 아이 컨텍스트 child 쿼리 전파) — 팀원 브랜치 파일을 동일 내용으로 선반영해 합류 시 충돌 없음.
// UI 리뉴얼: 피그마 「개발 배포용」 2.0 Case A/B 대조 — h-dvh 한 화면 수납(세로 스크롤 금지, T071·T077 유지).
// Case A는 이어하기 카드+추천 1행만 보이는 시안 그대로, 초과 행은 overflow-hidden으로 클립(더미 6종 DOM 유지).
import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BottomNav } from '@/components/bottom-nav';
import { recommendedThumbnailUrls, storyThumbnailUrl } from '@/lib/assets';
import { givenName } from '@/lib/profile-display';
import { difficultyLabel } from '@/lib/stories-view';

export type StoryMeta = {
  id: string;
  title: string;
  difficulty: string;
  topics: string[];
  estimatedMinutes: number;
};

type SessionProgress = {
  sessionId: string;
  progress: { n: number; N: number; percent: number };
};

/** 추천 더미 5~6종 메타 — 클릭 불가(MVP), 썸네일 recommended/01~06과 순서 일치. 표시용 임시 값 */
const DUMMY_STORIES = [
  { title: '선녀와 나무꾼', keywords: ['약속', '배려'], difficulty: '보통', minutes: 15 },
  { title: '해와 달이 된 오누이', keywords: ['용기', '지혜'], difficulty: '보통', minutes: 20 },
  { title: '금도끼 은도끼', keywords: ['정직', '욕심'], difficulty: '쉬움', minutes: 15 },
  { title: '토끼와 거북이', keywords: ['끈기', '겸손'], difficulty: '쉬움', minutes: 15 },
  { title: '혹부리 영감', keywords: ['욕심', '재치'], difficulty: '보통', minutes: 20 },
  { title: '개미와 베짱이', keywords: ['성실', '준비'], difficulty: '쉬움', minutes: 15 },
];

/* 칩 팔레트 (피그마 2.0/2.2/2.3 공통) — 파스텔 배경은 시안 그대로,
   글자색은 같은 색상 계열에서 명도만 낮춰 대비 4.5:1 하한을 맞춘 값(시안 원색은 2.1~2.5:1 미달). */
const TOPIC_CHIP_TINTS = ['bg-primary/15 text-[#B33D0D]', 'bg-sunny/15 text-[#92400E]'] as const;
const CARD_TOPIC_CHIP = 'bg-[#F7F1E8] text-[#B33D0D]';
const DIFFICULTY_CHIP_TINT: Record<string, string> = {
  '새싹 이야기': 'bg-sage/15 text-[#047857]',
  '튼튼 이야기': 'bg-sky/15 text-[#075985]',
  '도전 이야기': 'bg-berry/15 text-[#9F1239]',
};

function difficultyChip(raw: string): { label: string; tint: string } {
  const label = difficultyLabel(raw);
  return { label, tint: DIFFICULTY_CHIP_TINT[label] ?? 'bg-sky/15 text-[#075985]' };
}

function Chip({ tint, rounded = 'rounded-md', children }: { tint: string; rounded?: string; children: ReactNode }) {
  return (
    <span className={`${rounded} px-2.5 py-1 font-display text-lg font-bold leading-none ${tint}`}>
      {children}
    </span>
  );
}

type HomeScreenProps = {
  childId: string;
  childName: string;
  story: StoryMeta;
  hasSession: boolean;
};

export function HomeScreen({ childId, childName, story, hasSession }: HomeScreenProps) {
  const router = useRouter();
  const [resume, setResume] = useState<SessionProgress | null>(null);
  const [resumeError, setResumeError] = useState(false);

  useEffect(() => {
    if (!hasSession) return; // 세션 없으면 호출 금지 — POST /api/sessions는 생성 부작용이 있다
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ childId, storyId: story.id }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = (await res.json()) as SessionProgress;
        if (!cancelled) setResume(payload);
      } catch {
        if (!cancelled) setResumeError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [childId, hasSession, story.id]);

  const dummies = recommendedThumbnailUrls().map((url, i) => ({ url, ...DUMMY_STORIES[i] }));
  // 진행 중인 이야기가 없을 때만 1번 카드 '방귀 뀌는 며느리' 고정 — 있으면 더미 6개 (2.0 예외 처리)
  const dummySlots = hasSession ? dummies : dummies.slice(0, 5);
  const percent = resume ? Math.min(100, Math.max(0, Math.round(resume.progress.percent))) : 0;
  const storyDifficulty = difficultyChip(story.difficulty);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-base">
      {/* Header — 상단 고정 (핸드오프 §2.1, 피그마 h104·하단 보더 #F0E4D3) */}
      <header className="flex h-[104px] shrink-0 items-center justify-between gap-4 border-b border-[#F0E4D3] bg-base/90 px-10">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-display text-lg font-bold text-[#75664F]">반가워요!</p>
          <h1 className="truncate font-display text-[32px] leading-none text-ink">
            {givenName(childName)} 어린이
          </h1>
        </div>
        <Link
          href="/profiles"
          aria-label="아이 프로필 선택으로 이동"
          className="flex size-[71px] shrink-0 items-center justify-center rounded-[20px] border-2 border-primary bg-[#FFEDE3] text-4xl shadow-[0_4px_15px_rgba(255,122,61,0.5)] active:opacity-80"
        >
          <span aria-hidden>👤</span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[1194px] min-h-0 flex-1 flex-col overflow-hidden px-6 pt-5 pb-2">
        {/* 이어하기 — 진행 중인 이야기가 있는 경우에만 노출 (2.0 Case A, 카드 1146×340 bg #FFE8C9 r24) */}
        {hasSession && (
          <section
            aria-label="이어하기"
            className="flex shrink-0 gap-[30px] rounded-3xl bg-[#FFE8C9] p-6 shadow-[0_6px_24px_rgba(58,44,30,0.1)]"
          >
            {/* 시안 509×302 비율 고정 — 원본(4:3) 비율을 따르면 카드가 세로로 커져 추천 1행이 GNB에 잘림 */}
            <div className="relative aspect-[509/302] w-[44%] shrink-0 self-center overflow-hidden rounded-[20px] shadow-[0_4px_16px_rgba(58,44,30,0.08)]">
              <Image
                src={storyThumbnailUrl(false)}
                alt=""
                width={1448}
                height={1086}
                sizes="(max-width: 1194px) 44vw, 509px"
                loading="eager"
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <h2 className="flex items-center gap-1.5 font-display text-xl text-[#B33D0D]">
                <span aria-hidden>📖</span> 이어하기
              </h2>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {story.topics.map((topic, i) => (
                  <Chip key={topic} tint={TOPIC_CHIP_TINTS[i % TOPIC_CHIP_TINTS.length]}>
                    {topic}
                  </Chip>
                ))}
                <Chip rounded="rounded-lg" tint={storyDifficulty.tint}>
                  {storyDifficulty.label}
                </Chip>
              </div>
              <p className="mt-3 truncate font-display text-[32px] leading-tight text-ink">{story.title}</p>
              {resume ? (
                <>
                  <p className="mt-1.5 font-display text-xl text-[#75664F]">
                    장면 {resume.progress.n}/{resume.progress.N} 진행 중 ⋯
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="font-display text-lg text-[#75664F]">진행률</span>
                    <span className="font-display text-lg text-[#B33D0D]">{percent}%</span>
                  </div>
                  <div
                    className="mt-2 h-[11px] overflow-hidden rounded bg-ink/10"
                    role="progressbar"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="h-full rounded bg-primary" style={{ width: `${percent}%` }} />
                  </div>
                </>
              ) : (
                <p className="mt-auto pt-2 text-lg text-[#75664F]">
                  {resumeError ? '이어하기 정보를 불러오지 못했어요.' : '진행 정보를 불러오는 중…'}
                </p>
              )}
              <button
                type="button"
                disabled={!resume}
                onClick={() =>
                  resume &&
                  router.push(`/play/${resume.sessionId}?child=${childId}&story=${story.id}`)
                }
                className="mt-5 h-[55px] w-full shrink-0 rounded-full bg-primary font-display text-xl font-bold text-white shadow-[0_5px_10px_rgba(255,122,61,0.33)] active:opacity-90 disabled:opacity-40"
              >
                이야기 계속하기
              </button>
            </div>
          </section>
        )}

        {/* 추천 이야기 3×2 고정 6개 (2.0) — Case A는 1행만 노출(초과분 클립), Case B는 2행 전체 */}
        <section
          aria-label="추천 이야기"
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${hasSession ? 'mt-4' : 'mt-2'}`}
        >
          <div className="flex shrink-0 items-center justify-between px-2.5">
            <div className="flex min-w-0 flex-col">
              <h2 className="font-display text-2xl text-ink">추천 이야기</h2>
              {!hasSession && (
                <p className="mt-1.5 font-display text-lg font-bold text-[#75664F]">
                  원하는 이야기를 골라 동화 속 인물과 대화해보세요.
                </p>
              )}
            </div>
            <Link
              href={`/stories?child=${childId}`}
              className="flex h-12 shrink-0 items-center gap-1 font-display text-lg font-bold text-[#B33D0D] active:opacity-70"
            >
              모두 보기 <span aria-hidden>›</span>
            </Link>
          </div>
          <div className="mt-4 grid shrink-0 grid-cols-3 gap-5">
            {!hasSession && (
              <Link
                href={`/stories/${story.id}?child=${childId}`}
                className="flex flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_4px_16px_rgba(58,44,30,0.08)] transition-transform active:scale-95"
              >
                <Image
                  src={storyThumbnailUrl(true)}
                  alt=""
                  width={1448}
                  height={1086}
                  sizes="370px"
                  loading="eager"
                  className="aspect-[369/130] w-full object-cover"
                />
                <div className="flex flex-col gap-2 p-3.5">
                  <p className="truncate font-display text-[22px] leading-tight text-ink">{story.title}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {story.topics.slice(0, 2).map((topic) => (
                      <Chip key={topic} tint={CARD_TOPIC_CHIP}>
                        {topic}
                      </Chip>
                    ))}
                    <Chip rounded="rounded-lg" tint={storyDifficulty.tint}>
                      {storyDifficulty.label}
                    </Chip>
                    <Chip rounded="rounded-lg" tint="bg-[#F5EDE0] text-[#75664F]">
                      {story.estimatedMinutes}분
                    </Chip>
                  </div>
                </div>
              </Link>
            )}
            {dummySlots.map((dummy) => {
              const dummyDifficulty = difficultyChip(dummy.difficulty);
              return (
                // 미공개 이야기 — 클릭 이벤트 미부여(커서 default·무반응), 별도 에러 없음 (2.0 예외 처리)
                <div
                  key={dummy.title}
                  aria-disabled
                  className="flex flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_4px_16px_rgba(58,44,30,0.08)]"
                >
                  <Image
                    src={dummy.url}
                    alt=""
                    width={400}
                    height={400}
                    sizes="370px"
                    loading="eager"
                    className="aspect-[369/130] w-full object-cover"
                  />
                  <div className="flex flex-col gap-2 p-3.5">
                    <p className="truncate font-display text-[22px] leading-tight text-ink">{dummy.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {dummy.keywords.map((keyword) => (
                        <Chip key={keyword} tint={CARD_TOPIC_CHIP}>
                          {keyword}
                        </Chip>
                      ))}
                      <Chip rounded="rounded-lg" tint={dummyDifficulty.tint}>
                        {dummyDifficulty.label}
                      </Chip>
                      <Chip rounded="rounded-lg" tint="bg-[#F5EDE0] text-[#75664F]">
                        {dummy.minutes}분
                      </Chip>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* GNB — 하단 고정, T049 공용 컴포넌트 (2.0: 홈 유지·이야기 이동·단어장 이동 없음·마이페이지 이동) */}
      <BottomNav active="home" childId={childId} />
    </div>
  );
}
