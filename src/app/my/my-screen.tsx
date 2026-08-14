'use client';
// 내정보 화면 본체 (T056, 기능명세서 3.1 / UI 리뉴얼 E — 피그마 「개발 배포용」 3.1 내정보 기본·Case B·로그아웃).
// 사용자 정보 카드(보호자 이미지·"보호자님"·로그인 방식) → 등록된 아이 카드(팔레트 순환, 표시 전용) →
// 이번 주 활동 요약 3종(배지 카드만 클릭 → 3.6) → 설정 메뉴(공지/고객센터/이용안내/로그아웃) → v1.0.0.
// 로그아웃은 Supabase signOut 후 1.1 로그인 화면으로 — 실패 시 팝업 유지·재시도 (3.2 삭제 팝업과 동일 관례).
import { useState, type ComponentType } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ChildProfile } from '@/app/profiles/profiles-screen';
import { BottomNav, withChild } from '@/components/bottom-nav';
import { BookIcon, ChatBubbleIcon, ChevronRightIcon, HangingMedalIcon } from '@/components/icons';
import { assetUrl } from '@/lib/assets';
import { givenName } from '@/lib/profile-display';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { ChildProfileCard, MyPageHeader } from './accordion';

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

/* 활동 요약 카드 아이콘 3종(책·말풍선·메달)은 components/icons.tsx 공용 세트로 이동 —
   완료 화면·배지 화면과 같은 글리프를 쓰기 위함 (수정사항 C1 / QA 4 아이콘 통일) */

/* 설정 메뉴 아이콘 — 스토리보드 3.1: 웜그레이(#8A7A68) 아웃라인 글리프 3종 (이모지 대체 2026-08-13).
   말풍선은 활동 요약 ChatBubbleIcon 재사용, 문서는 GNB NoteIcon 형태 참조한 아웃라인 변형 */
function MegaphoneIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 4.5 8.5 8.2H5A1.8 1.8 0 0 0 3.2 10v3.4A1.8 1.8 0 0 0 5 15.2h3.5L20 18.9z" />
      <path d="M9.3 15.5l1 5h2.7l-1-5.1" />
    </svg>
  );
}

function GuideIcon({ className = 'size-6' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="3" width="14" height="18" rx="1.8" />
      <path d="M9 8.5h6M9 12.5h6M9 16.5h4" />
    </svg>
  );
}

// 설정 메뉴 — 피그마 3.1 '설정' 카드 아이콘·순서
const MENU_ITEMS: { label: string; href: string; Icon: ComponentType<{ className?: string }> }[] = [
  { label: '공지사항', href: '/my/notices', Icon: MegaphoneIcon },
  { label: '고객센터', href: '/my/support', Icon: ChatBubbleIcon },
  { label: '이용안내', href: '/my/guide', Icon: GuideIcon },
];

type MyScreenProps = {
  loginMethodLabel: string;
  profiles: ChildProfile[];
  /** null이면 학습 현황 조회 실패 — 화면 유지 후 재조회 (3.1 예외 처리) */
  summary: WeeklySummary | null;
  /** 아이 컨텍스트(?child=) — GNB·내부 링크로 전파만 한다 (A3, 홈 복귀 시 유지) */
  childId: string | null;
};

export function MyScreen({ loginMethodLabel, profiles, summary, childId }: MyScreenProps) {
  const router = useRouter();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  return (
    <div className="flex min-h-dvh flex-col">
      <MyPageHeader />
      <main className="mx-auto flex w-full max-w-[848px] flex-1 flex-col px-6 pb-8 pt-5">
        {/* 사용자 정보 카드 — 보호자 이미지는 하나로 고정(표시 전용) */}
        <section className="flex items-center gap-4 rounded-3xl border border-[#F0E4D3] bg-white p-5 shadow-[0_4px_18px_rgba(58,44,30,0.07)]">
          <Image
            src={assetUrl('profiles/select/guardian.png')}
            alt=""
            width={62}
            height={53}
            className="h-[53px] w-[62px] shrink-0 object-contain"
          />
          <div className="min-w-0">
            <p className="text-base font-bold text-ink">보호자님</p>
            <p className="mt-1 text-sm text-[#8A7A68]">{loginMethodLabel}</p>
          </div>
        </section>

        {/* 등록된 아이 카드 리스트 — 표시 전용·클릭 불가, 이름은 성 제외 (3.1) */}
        <section className="mt-4 rounded-3xl border border-[#F0E4D3] bg-white p-5 shadow-[0_4px_18px_rgba(58,44,30,0.07)]">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">등록된 아이</h2>
            <Link
              href={withChild('/my/profiles', childId)}
              className="-my-2 flex min-h-12 items-center text-sm font-bold text-primary active:opacity-70"
            >
              프로필 관리 →
            </Link>
          </div>
          {profiles.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-3 rounded-[28px] bg-[#FFEDE3] p-6">
              <p className="text-base text-ink/70">{EMPTY_PROFILES_MESSAGE}</p>
              {/* 아이 추가 버튼을 통해 프로필 등록 가능 (3.1 예외 처리) — 등록은 3.2에서 */}
              <Link
                href={withChild('/my/profiles', childId)}
                className="flex h-12 items-center rounded-full bg-primary px-6 text-base font-bold text-white active:bg-ink"
              >
                ＋ 아이 추가
              </Link>
            </div>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile, index) => (
                <ChildProfileCard
                  key={profile.id}
                  profile={profile}
                  displayName={givenName(profile.name)}
                  index={index}
                />
              ))}
            </ul>
          )}
        </section>

        {/* 이번 주 활동 요약 — 카드 3종, 배지 카드만 클릭 가능(3.6 이동) */}
        <section className="mt-4 rounded-3xl bg-[#FFE8C9] p-4 pt-5">
          <h2 className="px-1 text-base font-bold text-ink">이번 주 활동 요약</h2>
          {summary === null ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white/65 p-4">
              <p className="text-[15px] text-ink/70">{SUMMARY_ERROR_MESSAGE}</p>
              <button
                type="button"
                onClick={() => router.refresh()}
                className="h-12 shrink-0 rounded-full bg-primary px-5 text-sm font-bold text-white active:bg-ink"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-4">
              <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/65 px-2 py-3.5">
                <BookIcon className="size-7 text-ink" />
                <span className="text-xl font-bold text-primary">{summary.completedCount}편</span>
                <span className="text-center text-xs text-[#8A7A68]">완료한 이야기</span>
              </div>
              <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/65 px-2 py-3.5">
                <ChatBubbleIcon className="size-7 text-ink" />
                <span className="text-xl font-bold text-sage">{summary.chatCount}회</span>
                <span className="text-center text-xs text-[#8A7A68]">대화 횟수</span>
              </div>
              <Link
                href={withChild('/my/badges', childId)}
                className="flex flex-col items-center gap-1 rounded-2xl bg-white/65 px-2 py-3.5 active:bg-white"
              >
                <HangingMedalIcon className="size-7" />
                {/* 스토리보드 실측 Sunny(#FFC93C) 그대로 — 흰 바탕 대비 1.7:1 미달을 인지하고 채택
                    (QA 13 "색상 기준은 스토리보드 기준으로") */}
                <span className="text-xl font-bold text-sunny">{summary.badgeCount}개</span>
                <span className="text-center text-xs text-[#8A7A68]">획득한 배지</span>
              </Link>
            </div>
          )}
        </section>

        {/* 설정 — 공지사항·고객센터·이용안내·로그아웃 */}
        <section className="mt-6 overflow-hidden rounded-3xl border border-[#F0E4D3] bg-white shadow-[0_4px_18px_rgba(58,44,30,0.07)]">
          <h2 className="flex h-[57px] items-center border-b border-[#F0E4D3] px-5 text-base font-bold text-ink">서비스 안내</h2>
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={withChild(item.href, childId)}
              className="flex h-[63px] items-center gap-3 border-b border-[#F0E4D3] px-5 text-base text-ink active:bg-background"
            >
              <item.Icon className="size-6 text-[#8A7A68]" />
              {item.label}
              <ChevronRightIcon className="ml-auto size-4 text-[#8A7A68]" />
            </Link>
          ))}
          <div aria-hidden className="h-1 bg-background" />
          <button
            type="button"
            onClick={() => {
              setLogoutError(null);
              setLogoutOpen(true);
            }}
            className="flex h-14 w-full items-center px-5 text-base font-bold text-berry active:bg-background"
          >
            로그아웃
          </button>
        </section>

        <p className="mt-10 text-center text-sm text-[#888888]">v1.0.0</p>
      </main>

      {/* 로그아웃 확인 팝업 — 확인 시 signOut → 1.1 로그인, 취소 시 현재 화면 유지 (3.1 화면 이동) */}
      {logoutOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="로그아웃 확인"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1A14]/50 px-6"
        >
          <div className="flex w-full max-w-[360px] flex-col gap-6 rounded-[20px] bg-white p-8 text-center shadow-[0_20px_60px_rgba(30,26,20,0.25)]">
            <p className="text-lg font-bold text-[#1E1A14]">{LOGOUT_CONFIRM_MESSAGE}</p>
            {logoutError && <p className="text-sm font-semibold text-berry">{logoutError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setLogoutOpen(false)}
                className="h-12 rounded-xl border border-[#E8E2DA] bg-[#F7F6F3] text-[15px] font-bold text-[#1E1A14] active:opacity-80"
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
                    // scope: 'global' — 이 계정의 모든 기기 세션(리프레시 토큰) 폐기 (QA 32).
                    // supabase-js 기본값과 같지만 의도를 코드에 남긴다.
                    const { error } = await getSupabaseBrowser().auth.signOut({ scope: 'global' });
                    if (error) throw new Error(error.message);
                    router.replace('/login');
                  } catch {
                    setLogoutError(LOGOUT_ERROR); // 실패 → 팝업 유지·재시도 가능
                    setLoggingOut(false);
                  }
                }}
                className="h-12 rounded-xl bg-primary text-[15px] font-bold text-white active:bg-ink disabled:opacity-60"
              >
                {loggingOut ? '로그아웃 중…' : '로그아웃'}
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomNav active="my" childId={childId} />
    </div>
  );
}
