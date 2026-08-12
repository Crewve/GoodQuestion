'use client';
// 내정보 화면 본체 (T056, 기능명세서 3.1) — 사용자 정보 카드(고정 프로필 이미지·"보호자님")·
// 로그인 방식 문구·아이 프로필 리스트(표시 전용, 이름은 성 제외)·주간 요약 카드 3종
// (배지 카드만 클릭 → 3.6)·메뉴 버튼(공지/고객센터/이용안내)·로그아웃 확인 팝업.
// 로그아웃은 Supabase signOut 후 1.1 로그인 화면으로 — 실패 시 팝업 유지·재시도 (3.2 삭제 팝업과 동일 관례).
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ChildProfile } from '@/app/profiles/profiles-screen';
import { BottomNav } from '@/components/bottom-nav';
import { avatarUrl, type AvatarKey } from '@/lib/assets';
import { givenName, koreanAge } from '@/lib/profile-display';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export type WeeklySummary = {
  /** 이번 주 완료한 이야기(완료 세션) 수 */
  completedCount: number;
  /** 이번 주 아이 발화(대화) 수 */
  chatCount: number;
  /** 이번 주 획득한 배지 수 — 완주 배지 1종/완료 (T055 임시 규칙) */
  badgeCount: number;
};

// 기능명세서 3.1 문구 원문
const EMPTY_PROFILES_MESSAGE = '등록된 아이 프로필이 없습니다';
const SUMMARY_ERROR_MESSAGE = '학습 정보를 불러오지 못했습니다';
const LOGOUT_CONFIRM_MESSAGE = '정말 로그아웃 하시겠습니까?';
const LOGOUT_ERROR = '로그아웃에 실패했어요. 잠시 후 다시 시도해 주세요.';

const AVATAR_KEYS = new Set<string>(['boy-1', 'boy-2', 'girl-1', 'girl-2']);

const MENU_ITEMS: { label: string; href: string }[] = [
  { label: '공지사항', href: '/my/notices' },
  { label: '고객센터', href: '/my/support' },
  { label: '이용안내', href: '/my/guide' },
];

type MyScreenProps = {
  loginMethodLabel: string;
  profiles: ChildProfile[];
  /** null이면 학습 현황 조회 실패 — 화면 유지 후 재조회 (3.1 예외 처리) */
  summary: WeeklySummary | null;
};

export function MyScreen({ loginMethodLabel, profiles, summary }: MyScreenProps) {
  const router = useRouter();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-5 py-6">
        <h1 className="font-display text-3xl text-ink">내정보</h1>

        {/* 사용자 정보 카드 — 프로필 이미지는 하나로 고정(표시 전용) */}
        <section className="flex items-center gap-4 rounded-3xl bg-white p-4">
          <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-base text-3xl">
            👤
          </span>
          <div className="min-w-0">
            <p className="text-xl font-bold text-ink">보호자님</p>
            <p className="text-base text-ink/60">{loginMethodLabel}</p>
          </div>
        </section>

        {/* 등록된 아이 프로필 카드 리스트 — 표시 전용·클릭 불가, 이름은 성 제외 (3.1) */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-ink">아이 프로필</h2>
            <Link
              href="/my/profiles"
              className="flex h-11 items-center rounded-full bg-white px-4 text-base font-semibold text-ink active:opacity-80"
            >
              프로필 관리
            </Link>
          </div>
          {profiles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-6">
              <p className="text-lg text-ink/70">{EMPTY_PROFILES_MESSAGE}</p>
              {/* 아이 추가 버튼을 통해 프로필 등록 가능 (3.1 예외 처리) — 등록은 3.2에서 */}
              <Link
                href="/my/profiles"
                className="flex h-12 items-center rounded-full bg-primary px-6 text-lg font-bold text-white active:bg-ink"
              >
                ＋ 아이 추가
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {profiles.map((profile) => {
                const age = koreanAge(profile.birthDate);
                const hasAvatar = !!profile.avatarKey && AVATAR_KEYS.has(profile.avatarKey);
                return (
                  <li key={profile.id} className="flex items-center gap-4 rounded-3xl bg-white p-4">
                    {hasAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element -- Storage 외부 URL (기존 화면과 동일 패턴)
                      <img
                        src={avatarUrl(profile.avatarKey as AvatarKey, 'avatar')}
                        alt=""
                        className="size-16 shrink-0 rounded-2xl object-contain"
                      />
                    ) : (
                      <span aria-hidden className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-base text-3xl">
                        🙂
                      </span>
                    )}
                    <span className="min-w-0 truncate text-xl font-bold text-ink">{givenName(profile.name)}</span>
                    {age !== null && (
                      <span className="ml-auto rounded-full bg-sunny px-3 py-1 text-base font-semibold text-ink">
                        만 {age}세
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 이번 주 활동 요약 — 카드 3종, 배지 카드만 클릭 가능(3.6 이동) */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-ink">이번 주 활동</h2>
          {summary === null ? (
            <div className="flex items-center justify-between gap-3 rounded-3xl bg-white p-4">
              <p className="text-base text-ink/70">{SUMMARY_ERROR_MESSAGE}</p>
              <button
                type="button"
                onClick={() => router.refresh()}
                className="h-11 shrink-0 rounded-full bg-primary px-4 text-base font-semibold text-white active:bg-ink"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-1 rounded-3xl bg-white p-4">
                <span aria-hidden className="text-2xl">📚</span>
                <span className="text-2xl font-bold text-ink">{summary.completedCount}</span>
                <span className="text-center text-sm font-semibold text-ink/60">완료한 이야기</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-3xl bg-white p-4">
                <span aria-hidden className="text-2xl">💬</span>
                <span className="text-2xl font-bold text-ink">{summary.chatCount}</span>
                <span className="text-center text-sm font-semibold text-ink/60">대화 횟수</span>
              </div>
              <Link
                href="/my/badges"
                className="flex flex-col items-center gap-1 rounded-3xl bg-white p-4 active:bg-base"
              >
                <span aria-hidden className="text-2xl">🏅</span>
                <span className="text-2xl font-bold text-ink">{summary.badgeCount}</span>
                <span className="text-center text-sm font-semibold text-ink/60">획득한 배지</span>
              </Link>
            </div>
          )}
        </section>

        {/* 메뉴 — 공지사항·고객센터·이용안내·로그아웃 */}
        <section className="flex flex-col overflow-hidden rounded-3xl bg-white">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex h-14 items-center justify-between border-b border-ink/5 px-5 text-lg font-semibold text-ink active:bg-base"
            >
              {item.label}
              <span aria-hidden className="text-ink/30">›</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setLogoutError(null);
              setLogoutOpen(true);
            }}
            className="flex h-14 items-center px-5 text-lg font-semibold text-berry active:bg-base"
          >
            로그아웃
          </button>
        </section>
      </main>

      {/* 로그아웃 확인 팝업 — 확인 시 signOut → 1.1 로그인, 취소 시 현재 화면 유지 (3.1 화면 이동) */}
      {logoutOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="로그아웃 확인"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-6"
        >
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-white p-6 text-center">
            <p className="text-xl font-bold text-ink">{LOGOUT_CONFIRM_MESSAGE}</p>
            {logoutError && <p className="text-base font-semibold text-berry">{logoutError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setLogoutOpen(false)}
                className="h-12 flex-1 rounded-full bg-base text-lg font-bold text-ink active:opacity-80"
              >
                취소
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={async () => {
                  setLoggingOut(true);
                  setLogoutError(null);
                  try {
                    const { error } = await getSupabaseBrowser().auth.signOut();
                    if (error) throw new Error(error.message);
                    router.replace('/login');
                  } catch {
                    setLogoutError(LOGOUT_ERROR); // 실패 → 팝업 유지·재시도 가능
                    setLoggingOut(false);
                  }
                }}
                className="h-12 flex-1 rounded-full bg-berry text-lg font-bold text-white active:bg-ink disabled:opacity-60"
              >
                {loggingOut ? '로그아웃 중…' : '로그아웃'}
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomNav active="my" childId={null} />
    </div>
  );
}
