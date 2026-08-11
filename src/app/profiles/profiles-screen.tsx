'use client';
// 아이 프로필 선택·추가 화면 본체 (T047, 기능명세서 2.1·2.1.1) — 카드 최대 3 + 아이 추가 카드(3명 시 숨김),
// 만 나이 배지(비정상 데이터 미표시), 카드 클릭 시 테두리 표시 후 홈 진입(아이 컨텍스트 ?child=).
// 추가 폼은 별도 화면(2.1.1) 요건 — URL 추가 없이 화면 내 뷰 전환으로 구현(완료/취소 시 2.1 목록 복귀).
// 저장은 파트2 T046(/api/profiles) 합류 지점 — save-profile.ts 인터페이스만 호출, 미구현 동안 대기 안내.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChildProfileForm } from '@/components/child-profile-form';
import { avatarUrl, type AvatarKey } from '@/lib/assets';
import { koreanAge } from '@/lib/profile-display';
import { saveChildProfile } from './save-profile';

export type ChildProfile = {
  id: string;
  name: string;
  /** children.birth_date (DATE) 조회값 'YYYY-MM-DD' — 만 나이 배지 원천, 없으면 배지 미표시 */
  birthDate: string | null;
  avatarKey: string | null;
};

const AVATAR_KEYS = new Set<string>(['boy-1', 'boy-2', 'girl-1', 'girl-2']);

// T046(파트2) 라우트 연결 전 대기 안내 — save-profile.ts가 404를 NOT_READY로 돌려준다
const SAVE_NOT_READY = '프로필 저장 기능을 준비하고 있어요. 조금만 기다려 주세요!';
const SAVE_ERROR = '등록에 실패했어요. 잠시 후 다시 시도해 주세요.';

export function ProfilesScreen({ profiles }: { profiles: ChildProfile[] }) {
  const router = useRouter();
  const [view, setView] = useState<'list' | 'add'>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectChild = (id: string) => {
    setSelectedId(id); // 선택 테두리 표시 (2.1 구성요소)
    router.push(`/home?child=${id}`); // 카드 클릭 → 2.0 홈 (선택된 아이 컨텍스트)
  };

  if (view === 'add') {
    return (
      <main className="flex min-h-dvh flex-col items-center gap-6 px-6 py-10">
        <h1 className="font-display text-3xl text-ink">아이 프로필 추가</h1>
        <ChildProfileForm
          onCancel={() => setView('list')} // 취소 → 2.1 복귀 (추가 등록된 아이 없음)
          onSubmit={async (value) => {
            const result = await saveChildProfile({ ...value, consent: true });
            if (!result.ok) {
              throw new Error(result.reason === 'NOT_READY' ? SAVE_NOT_READY : (result.message ?? SAVE_ERROR));
            }
            setView('list'); // 완료 → 갱신된 목록으로 복귀 (2.1.1 화면 이동)
            router.refresh();
          }}
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      <h1 className="font-display text-3xl text-ink">아이 프로필 선택</h1>

      {profiles.length === 0 && (
        <p className="text-lg text-ink">아직 등록된 친구가 없어요</p>
      )}

      <div className="grid w-full max-w-3xl grid-cols-2 gap-4 sm:grid-cols-4">
        {profiles.map((profile) => {
          const age = koreanAge(profile.birthDate);
          const hasAvatar = !!profile.avatarKey && AVATAR_KEYS.has(profile.avatarKey);
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => selectChild(profile.id)}
              className={`flex flex-col items-center gap-2 rounded-3xl border-4 bg-white p-4 transition-colors ${
                selectedId === profile.id ? 'border-primary' : 'border-white'
              }`}
            >
              {hasAvatar ? (
                <img
                  src={avatarUrl(profile.avatarKey as AvatarKey, 'avatar')}
                  alt=""
                  className="aspect-square w-full rounded-2xl object-contain"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex aspect-square w-full items-center justify-center rounded-2xl bg-base text-4xl"
                >
                  🙂
                </span>
              )}
              <span className="text-lg font-bold text-ink">{profile.name}</span>
              {/* 계산값 0세 미만/150세 이상은 비정상 데이터 — 배지 미표시 (2.1 유효성) */}
              {age !== null && (
                <span className="rounded-full bg-sunny px-3 py-1 text-base font-semibold text-ink">
                  만 {age}세
                </span>
              )}
            </button>
          );
        })}

        {/* 아이 추가 카드 — 3명 도달 시 카드 자체 숨김 (2.1 구성요소) */}
        {profiles.length < 3 && (
          <button
            type="button"
            onClick={() => setView('add')}
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-3xl border-4 border-dashed border-ink/30 text-ink"
          >
            <span aria-hidden className="text-4xl">
              ＋
            </span>
            <span className="text-lg font-bold">아이 추가</span>
          </button>
        )}
      </div>
    </main>
  );
}
