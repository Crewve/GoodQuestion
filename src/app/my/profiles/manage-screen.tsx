'use client';
// 아이 프로필 관리 화면 본체 (T057, 기능명세서 3.2) — 등록된 프로필 카드 목록(표시 전용) + 아이 추가.
// 아이 추가는 2.1.1 폼 재사용(ChildProfileForm — 2.1 선택 화면 T047과 동일 컴포넌트·저장 래퍼),
// 3.2 요건대로 3명 미만일 때만 가능하고 3명이면 버튼 비활성 + 초과 문구를 노출한다(2.1의 '카드 숨김'과 다름).
// 구성요소 표의 '프로필 관리' 버튼은 동작·이동이 미정의(수정/삭제는 MVP 범위 밖)라 미구현 — tasks.md 기록, 기획 확인 필요.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ChildProfile } from '@/app/profiles/profiles-screen';
import { saveChildProfile } from '@/app/profiles/save-profile';
import { BottomNav } from '@/components/bottom-nav';
import { ChildProfileForm } from '@/components/child-profile-form';
import { avatarUrl, type AvatarKey } from '@/lib/assets';
import { koreanAge } from '@/lib/profile-display';

// 기능명세서 3.2 문구 원문
const EMPTY_MESSAGE = '등록된 아이 프로필이 없습니다';
const LIMIT_MESSAGE = '아이 프로필은 최대 3개까지 등록할 수 있습니다';
const SAVE_ERROR = '등록에 실패했어요. 잠시 후 다시 시도해 주세요.';

const AVATAR_KEYS = new Set<string>(['boy-1', 'boy-2', 'girl-1', 'girl-2']);

export function ManageProfilesScreen({ profiles }: { profiles: ChildProfile[] }) {
  const router = useRouter();
  const [view, setView] = useState<'list' | 'add'>('list');

  if (view === 'add') {
    // 아이 추가 → 2.1.1 아이 프로필 추가 등록 (화면 이동 — 폼 재사용, 완료/취소 시 목록 복귀)
    return (
      <main className="flex min-h-dvh flex-col items-center gap-6 px-6 py-10">
        <h1 className="font-display text-3xl text-ink">아이 프로필 추가</h1>
        <ChildProfileForm
          onCancel={() => setView('list')}
          onSubmit={async (value) => {
            const result = await saveChildProfile({ ...value, consent: true });
            if (!result.ok) throw new Error(result.message ?? SAVE_ERROR); // 실패 → 현재 화면 유지 (폼 에러 표시)
            setView('list');
            router.refresh(); // 갱신된 목록으로 복귀
          }}
        />
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-5 py-6">
        <Link href="/my" className="flex h-12 items-center gap-1 self-start font-semibold text-ink active:opacity-70">
          <span aria-hidden>‹</span> 내정보
        </Link>
        <h1 className="font-display text-3xl text-ink">아이 프로필 관리</h1>

        {profiles.length === 0 && <p className="text-lg text-ink/70">{EMPTY_MESSAGE}</p>}

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
                <span className="text-xl font-bold text-ink">{profile.name}</span>
                {/* 비정상 생년월일은 배지 미표시 — 2.1과 동일 규칙 */}
                {age !== null && (
                  <span className="ml-auto rounded-full bg-sunny px-3 py-1 text-base font-semibold text-ink">
                    만 {age}세
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {/* 아이 추가 — 3명 미만일 때만 가능, 3명이면 비활성 + 초과 문구 (3.2 유효성·예외 처리) */}
        <button
          type="button"
          disabled={profiles.length >= 3}
          onClick={() => setView('add')}
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-primary text-xl font-bold text-white active:bg-ink disabled:bg-ink/20 disabled:text-ink/50"
        >
          ＋ 아이 추가
        </button>
        {profiles.length >= 3 && <p className="text-center text-base text-ink/60">{LIMIT_MESSAGE}</p>}
      </main>
      <BottomNav active="my" childId={null} />
    </div>
  );
}
