'use client';
// 홈 화면 본체 (T048, 기능명세서 2.0) — 인사말(성 제외 이름)·이어하기 카드·추천 3×2·GNB.
// 이어하기: 진행 중 세션이 있을 때만 섹션 노출(서버 판정), 진행률 n/N·%는 T031 /api/sessions 응답 재사용
// (멱등 재개라 세션이 있을 때만 호출 — 없는데 호출하면 세션이 생성되므로 금지).
// 추천 3개(QA 22): 진행 중 이야기가 없을 때만 1번 카드 '방귀 뀌는 며느리' 고정·유일 클릭 가능(→ 이야기 상세),
// 있으면 더미 3종으로 채운다(2.0 예외 처리). 더미는 클릭 이벤트 미부여·흐린 '준비 중' 표시.
// Header·GNB는 상하단 고정(핸드오프 §2.1), GNB는 파트2 T049의 BottomNav 공용(단어장 이동 없음,
// 아이 컨텍스트 child 쿼리 전파) — 팀원 브랜치 파일을 동일 내용으로 선반영해 합류 시 충돌 없음.
// UI 리뉴얼: 피그마 「개발 배포용」 2.0 Case A/B 대조 — h-dvh 한 화면 수납(세로 스크롤 금지, T071·T077 유지).
// 추천은 1행 3개 고정이라 Case A(이어하기 카드 포함)에서도 클립 없이 들어간다.
import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BottomNav } from '@/components/bottom-nav';
import { ArrowNextIcon, PlayIcon, UserIcon } from '@/components/icons';
import { avatarUrl, recommendedThumbnailUrls, storyThumbnailUrl, type AvatarKey } from '@/lib/assets';
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

/** 추천 더미 7종 메타 — 클릭 불가(MVP), 썸네일 recommended/01~07과 순서 일치.
    주제·난이도·시간은 피그마 「개발 배포용」 2.0 Case B 카드 값 그대로 (프레임 간 값이 다른 경우 Case B 기준).
    흥부와 놀부는 피그마 코멘트 #170으로 추가. */
const DUMMY_STORIES = [
  { title: '선녀와 나무꾼', keywords: ['다름'], difficulty: '새싹 이야기', minutes: 15 },
  { title: '해와 달이 된 오누이', keywords: ['친절', '용기'], difficulty: '도전 이야기', minutes: 18 },
  { title: '금도끼 은도끼', keywords: ['나눔', '다름'], difficulty: '튼튼 이야기', minutes: 16 },
  { title: '토끼와 거북이', keywords: ['다름', '용기'], difficulty: '새싹 이야기', minutes: 13 },
  { title: '혹부리 영감', keywords: ['다름', '용기'], difficulty: '도전 이야기', minutes: 20 },
  { title: '개미와 베짱이', keywords: ['나눔', '친절'], difficulty: '새싹 이야기', minutes: 10 },
  { title: '흥부와 놀부', keywords: ['나눔', '친절'], difficulty: '새싹 이야기', minutes: 16 },
];

/* 칩 팔레트 — 피그마 「개발 배포용」 '주제'·'난이도' 심볼 실측: 배경 = 해당 색 13% 틴트, 글자 = 같은 색 원색
   (다름 Primary · 용기 Sunny · 친절 Berry · 나눔 Sage / 새싹 Sage · 튼튼 Sky · 도전 Berry).
   기존 명도 보정값은 QA 13("색상 기준은 스토리보드 기준으로")에 따라 철회 — 원색 대비 2.1~2.5:1 미달 인지하고 채택. */
const TOPIC_CHIP_BY_NAME: Record<string, string> = {
  다름: 'bg-primary/15 text-primary',
  용기: 'bg-sunny/15 text-sunny',
  친절: 'bg-berry/15 text-berry',
  나눔: 'bg-sage/15 text-sage',
};
/** 시안에 없는 주제어는 같은 4색을 순환 적용 */
const TOPIC_CHIP_CYCLE = [
  'bg-primary/15 text-primary',
  'bg-sunny/15 text-sunny',
  'bg-berry/15 text-berry',
  'bg-sage/15 text-sage',
] as const;

function topicChip(topic: string, index = 0): string {
  return TOPIC_CHIP_BY_NAME[topic] ?? TOPIC_CHIP_CYCLE[index % TOPIC_CHIP_CYCLE.length];
}

const DIFFICULTY_CHIP_TINT: Record<string, string> = {
  '새싹 이야기': 'bg-sage/15 text-sage',
  '튼튼 이야기': 'bg-sky/15 text-sky',
  '도전 이야기': 'bg-berry/15 text-berry',
};
const DIFFICULTY_CHIP_FALLBACK = 'bg-sky/15 text-sky';

function difficultyChip(raw: string): { label: string; tint: string } {
  const label = difficultyLabel(raw);
  return { label, tint: DIFFICULTY_CHIP_TINT[label] ?? DIFFICULTY_CHIP_FALLBACK };
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
  /** 헤더 프로필 버튼 (피그마 2.0 — 아이 아바타 이미지, 미보유 시 이모지 폴백) */
  childAvatarKey: string | null;
  story: StoryMeta;
  hasSession: boolean;
};

export function HomeScreen({ childId, childName, childAvatarKey, story, hasSession }: HomeScreenProps) {
  const avatarSrc =
    childAvatarKey && (['boy-1', 'boy-2', 'girl-1', 'girl-2'] as const).includes(childAvatarKey as AvatarKey)
      ? avatarUrl(childAvatarKey as AvatarKey, 'select') // 선택 화면과 같은 select/ 세트 (T068 — avatar/ 세트는 화풍이 달라 미사용)
      : null;
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
  // 피그마 2.0 Case A: 더미 3개 1행(선녀·해와 달·금도끼) / Case B: '방귀 뀌는 며느리' 고정 + 더미 6개(해와 달~흥부와 놀부)
  const dummySlots = hasSession ? dummies.slice(0, 3) : dummies.slice(1);
  const percent = resume ? Math.min(100, Math.max(0, Math.round(resume.progress.percent))) : 0;
  const storyDifficulty = difficultyChip(story.difficulty);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Header — 상단 고정 (핸드오프 §2.1, 피그마 h104·하단 보더 #F0E4D3) */}
      <header className="flex h-[104px] shrink-0 items-center justify-between gap-4 border-b border-[#F0E4D3] bg-background/90 px-10">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-display text-lg font-bold text-[#8A7A68]">반가워요!</p>
          <h1 className="truncate font-display text-[32px] leading-none text-ink">
            {givenName(childName)} 어린이
          </h1>
        </div>
        <Link
          href="/profiles"
          aria-label="아이 프로필 선택으로 이동"
          className="flex size-[71px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] border-2 border-primary bg-[#FFEDE3] text-4xl shadow-[0_4px_15px_rgba(255,122,61,0.5)] active:opacity-80"
        >
          {avatarSrc ? (
            <Image src={avatarSrc} alt="" width={59} height={57} className="size-[59px] object-contain" />
          ) : (
            <UserIcon className="size-9 text-primary" />
          )}
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
                src={storyThumbnailUrl(true)}
                alt=""
                width={1448}
                height={1086}
                sizes="(max-width: 1194px) 44vw, 509px"
                loading="eager"
                className="absolute inset-0 h-full w-full object-cover object-top"
              />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <h2 className="flex items-center gap-1.5 font-display text-xl text-primary">
                <PlayIcon className="size-6 text-primary" /> 이어하기
              </h2>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {story.topics.map((topic, i) => (
                  <Chip key={topic} tint={topicChip(topic, i)}>
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
                  <p className="mt-1.5 font-display text-xl text-[#8A7A68]">
                    장면 {resume.progress.n}/{resume.progress.N} 진행 중 ⋯
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="font-display text-lg text-[#8A7A68]">진행률</span>
                    <span className="font-display text-lg text-primary">{percent}%</span>
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
                <p className="mt-auto pt-2 text-lg text-[#8A7A68]">
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
                // 스토리보드 Button 심볼 실측: primary 필 + 흰 글자 (대비 2.6:1 미달 인지, QA 13 지시로 시안값 채택)
                className="mt-5 h-[55px] w-full shrink-0 rounded-full bg-primary font-display text-xl font-bold text-white shadow-[0_5px_10px_rgba(255,122,61,0.33)] active:opacity-90 disabled:opacity-40"
              >
                이야기 계속하기
              </button>
            </div>
          </section>
        )}

        {/* 추천 이야기 3개 1행 (QA 22 — 기존 3×2 6개에서 축소) */}
        <section
          aria-label="추천 이야기"
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${hasSession ? 'mt-4' : 'mt-2'}`}
        >
          <div className="flex shrink-0 items-center justify-between px-2.5">
            <div className="flex min-w-0 flex-col">
              <h2 className="font-display text-2xl text-ink">추천 이야기</h2>
              {!hasSession && (
                <p className="mt-1.5 font-display text-lg font-bold text-[#8A7A68]">
                  원하는 이야기를 골라 동화 속 인물과 대화해보세요.
                </p>
              )}
            </div>
            <Link
              href={`/stories?child=${childId}`}
              className="flex h-12 shrink-0 items-center gap-1 font-display text-lg font-bold text-primary active:opacity-70"
            >
              모두 보기 <ArrowNextIcon className="size-4" />
            </Link>
          </div>
          {/* Case A: 1행 3개 고정(minmax 행 — 화면이 낮으면 카드가 줄어들며 짤림 방지, #104)
              Case B: 219px 행 그리드 + 내부 세로 스크롤(헤더·GNB 고정 유지, 시안 7카드) */}
          <div
            className={`mt-4 grid min-h-0 flex-1 grid-cols-3 gap-5 ${
              hasSession ? 'grid-rows-[minmax(0,220px)]' : 'auto-rows-[219px] content-start overflow-y-auto pb-3'
            }`}
          >
            {!hasSession && (
              <Link
                href={`/stories/${story.id}?child=${childId}`}
                className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_4px_16px_rgba(58,44,30,0.08)] transition-transform active:scale-95"
              >
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <Image
                    src={storyThumbnailUrl(true)}
                    alt=""
                    fill
                    sizes="370px"
                    loading="eager"
                    className="object-cover"
                  />
                </div>
                <div className="flex shrink-0 flex-col gap-2 p-3.5">
                  <p className="truncate font-display text-[22px] leading-tight text-ink">{story.title}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {story.topics.slice(0, 2).map((topic, i) => (
                      <Chip key={topic} tint={topicChip(topic, i)}>
                        {topic}
                      </Chip>
                    ))}
                    <Chip rounded="rounded-lg" tint={storyDifficulty.tint}>
                      {storyDifficulty.label}
                    </Chip>
                    <Chip rounded="rounded-lg" tint="bg-[#F5EDE0] text-[#8A7A68]">
                      {story.estimatedMinutes}분
                    </Chip>
                  </div>
                </div>
              </Link>
            )}
            {dummySlots.map((dummy) => {
              const dummyDifficulty = difficultyChip(dummy.difficulty);
              return (
                // 미공개 이야기 — 클릭 이벤트 미부여(커서 default·무반응), 별도 에러 없음 (2.0 예외 처리).
                // 비활성임이 보이도록 흐리게 + '준비 중' 칩 (QA 3 — 이야기 목록 카드와 동일 처리)
                <div
                  key={dummy.title}
                  aria-disabled
                  className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] bg-white opacity-50 shadow-[0_4px_16px_rgba(58,44,30,0.08)]"
                >
                  <div className="relative min-h-0 flex-1 overflow-hidden">
                    <Image src={dummy.url} alt="" fill sizes="370px" loading="eager" className="object-cover" />
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 p-3.5">
                    <p className="truncate font-display text-[22px] leading-tight text-ink">{dummy.title}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {dummy.keywords.map((keyword, i) => (
                        <Chip key={keyword} tint={topicChip(keyword, i)}>
                          {keyword}
                        </Chip>
                      ))}
                      <Chip rounded="rounded-lg" tint={dummyDifficulty.tint}>
                        {dummyDifficulty.label}
                      </Chip>
                      <Chip rounded="rounded-lg" tint="bg-[#F5EDE0] text-[#8A7A68]">
                        {dummy.minutes}분
                      </Chip>
                      <Chip rounded="rounded-lg" tint="bg-[#EFE7DA] text-[#75664F]">
                        준비 중
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
