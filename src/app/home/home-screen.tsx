'use client';
// 홈 화면 본체 (T048, 기능명세서 2.0) — 인사말(성 제외 이름)·이어하기 카드·추천 3×2·GNB.
// 이어하기: 진행 중 세션이 있을 때만 섹션 노출(서버 판정), 진행률 n/N·%는 T031 /api/sessions 응답 재사용
// (멱등 재개라 세션이 있을 때만 호출 — 없는데 호출하면 세션이 생성되므로 금지).
// 추천 6개: 진행 중 이야기가 없을 때만 1번 카드 '방귀 뀌는 며느리' 고정·유일 클릭 가능(→ 이야기 상세),
// 있으면 더미 6종으로 채운다(2.0 예외 처리 — 더미 썸네일이 6종인 이유). 더미는 클릭 이벤트 미부여.
// Header·GNB는 상하단 고정(핸드오프 §2.1), GNB는 파트2 T049의 BottomNav 공용(단어장 이동 없음,
// 아이 컨텍스트 child 쿼리 전파) — 팀원 브랜치 파일을 동일 내용으로 선반영해 합류 시 충돌 없음.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BottomNav } from '@/components/bottom-nav';
import { recommendedThumbnailUrls, storyThumbnailUrl } from '@/lib/assets';
import { givenName } from '@/lib/profile-display';

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

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header — 상단 고정 (핸드오프 §2.1) */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 bg-base px-6 py-4">
        <h1 className="font-display text-2xl text-ink">반가워요 {givenName(childName)} 어린이</h1>
        <Link
          href="/profiles"
          aria-label="아이 프로필 선택으로 이동"
          className="flex size-12 items-center justify-center rounded-full bg-white text-2xl shadow"
        >
          <span aria-hidden>👤</span>
        </Link>
      </header>

      <main className="flex flex-1 flex-col gap-8 px-6 pb-8 pt-2">
        {/* 이어하기 — 진행 중인 이야기가 있는 경우에만 노출 (2.0) */}
        {hasSession && (
          <section aria-label="이어하기" className="flex w-full max-w-3xl flex-col gap-3">
            <h2 className="font-display text-xl text-ink">이어하기</h2>
            <div className="flex items-center gap-4 rounded-3xl bg-white p-4 shadow">
              <img
                src={storyThumbnailUrl(false)}
                alt=""
                className="h-28 w-28 shrink-0 rounded-2xl object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap gap-1">
                  {story.topics.map((topic) => (
                    <span key={topic} className="rounded-full bg-sunny px-2 py-0.5 text-sm font-semibold text-ink">
                      {topic}
                    </span>
                  ))}
                  <span className="rounded-full bg-sage px-2 py-0.5 text-sm font-semibold text-white">
                    {story.difficulty}
                  </span>
                </div>
                <p className="truncate text-lg font-bold text-ink">{story.title}</p>
                {resume ? (
                  <>
                    <p className="text-base text-ink">
                      장면 {resume.progress.n}/{resume.progress.N} 진행 중 ··· {percent}%
                    </p>
                    <div
                      className="h-3 overflow-hidden rounded-full bg-base"
                      role="progressbar"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                    </div>
                  </>
                ) : (
                  <p className="text-base text-ink">
                    {resumeError ? '이어하기 정보를 불러오지 못했어요.' : '진행 정보를 불러오는 중…'}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={!resume}
                onClick={() =>
                  resume &&
                  router.push(`/play/${resume.sessionId}?child=${childId}&story=${story.id}`)
                }
                className="h-12 shrink-0 rounded-full bg-primary px-5 text-base font-bold text-white active:bg-ink disabled:opacity-40"
              >
                이야기 계속하기
              </button>
            </div>
          </section>
        )}

        {/* 추천 이야기 3×2 고정 6개 (2.0) */}
        <section aria-label="추천 이야기" className="flex w-full max-w-3xl flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl text-ink">추천 이야기</h2>
            <Link href={`/stories?child=${childId}`} className="text-base font-semibold text-primary">
              모두 보기
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {!hasSession && (
              <Link
                href={`/stories/${story.id}?child=${childId}`}
                className="flex flex-col gap-2 rounded-3xl bg-white p-3 shadow transition-transform active:scale-95"
              >
                <img src={storyThumbnailUrl(true)} alt="" className="aspect-square w-full rounded-2xl object-cover" />
                <p className="truncate text-lg font-bold text-ink">{story.title}</p>
                <p className="truncate text-sm text-ink">
                  {story.topics.join(' · ')} · {story.difficulty} · {story.estimatedMinutes}분
                </p>
              </Link>
            )}
            {dummySlots.map((dummy) => (
              // 미공개 이야기 — 클릭 이벤트 미부여(커서 default·무반응), 별도 에러 없음 (2.0 예외 처리)
              <div key={dummy.title} aria-disabled className="flex flex-col gap-2 rounded-3xl bg-white/60 p-3">
                <img src={dummy.url} alt="" className="aspect-square w-full rounded-2xl object-cover opacity-70" />
                <p className="truncate text-lg font-bold text-ink/60">{dummy.title}</p>
                <p className="truncate text-sm text-ink/60">
                  {dummy.keywords.join(' · ')} · {dummy.difficulty} · {dummy.minutes}분
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* GNB — 하단 고정, T049 공용 컴포넌트 (2.0: 홈 유지·이야기 이동·단어장 이동 없음·마이페이지 이동) */}
      <BottomNav active="home" childId={childId} />
    </div>
  );
}
