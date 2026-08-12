'use client';
// 아이 프로필 관리 화면 본체 (T057, 기능명세서 3.2 / UI 리뉴얼 E) — 등록된 프로필 카드 목록 + 아이 추가 + 수정·삭제.
// 개발 배포용 시안에 전용 프레임이 없어 3.1 '등록된 아이' 카드 스타일(팔레트 순환)을 준용하고,
// 기존 기능 흐름(관리 모드 토글 → 카드별 수정·삭제, 삭제 확인 팝업)은 그대로 유지한다.
// 아이 추가·수정은 2.1.1 폼 재사용(ChildProfileForm — 수정은 initialValue·동의 재요구 없음),
// 3명 제한은 3.2 요건대로 버튼 비활성 + 초과 문구(2.1의 '카드 숨김'과 다름).
// 삭제는 확인 팝업 후 DELETE /api/profiles/[childId] — 학습 기록(세션·메시지·분석·활동 결과)까지 서버가 함께 삭제한다.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ChildProfile } from '@/app/profiles/profiles-screen';
import { saveChildProfile } from '@/app/profiles/save-profile';
import { BottomNav } from '@/components/bottom-nav';
import { ChildProfileForm, type ChildProfileFormValue } from '@/components/child-profile-form';
import type { AvatarKey } from '@/lib/assets';
import { ChildProfileCard, MyPageHeader } from '../accordion';

// 기능명세서 3.2 문구 원문
const EMPTY_MESSAGE = '등록된 아이 프로필이 없습니다';
const LIMIT_MESSAGE = '아이 프로필은 최대 3개까지 등록할 수 있습니다';
const SAVE_ERROR = '등록에 실패했어요. 잠시 후 다시 시도해 주세요.';
const UPDATE_ERROR = '수정에 실패했어요. 잠시 후 다시 시도해 주세요.';
const DELETE_ERROR = '삭제에 실패했어요. 잠시 후 다시 시도해 주세요.';

const AVATAR_KEYS = new Set<string>(['boy-1', 'boy-2', 'girl-1', 'girl-2']);

type View = { mode: 'list' } | { mode: 'add' } | { mode: 'edit'; child: ChildProfile };

/** ChildProfile(DB 조회값) → 수정 폼 초기값. 비정상 데이터(아바타·생년월일 결측)는 빈 폼으로 시작 */
function toFormValue(child: ChildProfile): ChildProfileFormValue | undefined {
  if (!child.avatarKey || !AVATAR_KEYS.has(child.avatarKey) || !child.birthDate) return undefined;
  return {
    name: child.name,
    birthDate: child.birthDate.replaceAll('-', ''), // ISO → 8자리 (폼 입력 형식)
    avatarKey: child.avatarKey as AvatarKey,
  };
}

async function requestJson(url: string, init: RequestInit, fallbackMessage: string): Promise<void> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? fallbackMessage);
  }
}

export function ManageProfilesScreen({ profiles }: { profiles: ChildProfile[] }) {
  const router = useRouter();
  const [view, setView] = useState<View>({ mode: 'list' });
  const [manageMode, setManageMode] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChildProfile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (view.mode === 'add' || view.mode === 'edit') {
    const editing = view.mode === 'edit' ? view.child : null;
    return (
      <main className="flex min-h-dvh flex-col items-center gap-6 px-6 py-10">
        <h1 className="font-display text-3xl text-ink">{editing ? '아이 프로필 수정' : '아이 프로필 추가'}</h1>
        <ChildProfileForm
          initialValue={editing ? toFormValue(editing) : undefined}
          showConsent={!editing} // 동의는 등록 시 1회 기록 유지 — 수정에서는 재요구하지 않음
          submitLabel={editing ? '수정하기' : '완료하기'}
          onCancel={() => setView({ mode: 'list' })}
          onSubmit={async (value) => {
            if (editing) {
              await requestJson(
                `/api/profiles/${editing.id}`,
                {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: value.name, avatar_key: value.avatarKey, birth_date: value.birthDate }),
                },
                UPDATE_ERROR,
              );
            } else {
              const result = await saveChildProfile({ ...value, consent: true });
              if (!result.ok) throw new Error(result.message ?? SAVE_ERROR); // 실패 → 현재 화면 유지 (폼 에러 표시)
            }
            setView({ mode: 'list' });
            router.refresh(); // 갱신된 목록으로 복귀
          }}
        />
      </main>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <MyPageHeader backHref="/my" />
      <main className="mx-auto flex w-full max-w-[848px] flex-1 flex-col px-6 pb-10 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#1E1A14]">아이 프로필 관리</h2>
          {/* '프로필 관리' 버튼(3.2 구성요소) — 관리 모드 토글: 카드별 수정·삭제 노출 */}
          {profiles.length > 0 && (
            <button
              type="button"
              onClick={() => setManageMode((on) => !on)}
              className={`h-12 rounded-full px-5 text-sm font-bold ${
                manageMode ? 'bg-ink text-white' : 'border border-[#E8E2DA] bg-white text-ink'
              } active:opacity-80`}
            >
              {manageMode ? '관리 완료' : '프로필 관리'}
            </button>
          )}
        </div>

        {profiles.length === 0 && <p className="mt-6 text-base text-[#7A7268]">{EMPTY_MESSAGE}</p>}

        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile, index) => (
            <ChildProfileCard
              key={profile.id}
              profile={profile}
              displayName={profile.name}
              index={index}
              // 비정상 생년월일은 배지 미표시(카드 내부 규칙) — 관리 모드에서는 배지 숨김 (기존 규칙 유지)
              showAge={!manageMode}
              footer={
                manageMode ? (
                  <span className="flex w-full gap-2">
                    <button
                      type="button"
                      onClick={() => setView({ mode: 'edit', child: profile })}
                      className="h-12 flex-1 rounded-full bg-white text-sm font-bold text-sky shadow-[0_2px_8px_rgba(58,44,30,0.08)] active:bg-sky active:text-white"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(profile);
                      }}
                      className="h-12 flex-1 rounded-full bg-white text-sm font-bold text-berry shadow-[0_2px_8px_rgba(58,44,30,0.08)] active:bg-berry active:text-white"
                    >
                      삭제
                    </button>
                  </span>
                ) : undefined
              }
            />
          ))}
        </ul>

        {/* 아이 추가 — 3명 미만일 때만 가능, 3명이면 비활성 + 초과 문구 (3.2 유효성·예외 처리) */}
        <button
          type="button"
          disabled={profiles.length >= 3}
          onClick={() => setView({ mode: 'add' })}
          className="mt-6 flex h-14 items-center justify-center gap-2 rounded-full bg-primary text-lg font-bold text-white active:bg-ink disabled:bg-ink/20 disabled:text-ink/50"
        >
          ＋ 아이 추가
        </button>
        {profiles.length >= 3 && <p className="mt-3 text-center text-sm text-[#7A7268]">{LIMIT_MESSAGE}</p>}
      </main>

      {/* 삭제 확인 팝업 — 학습 기록 동반 삭제 고지 후 진행 (로그아웃 팝업과 동일한 커스텀 다이얼로그) */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="프로필 삭제 확인"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1E1A14]/50 px-6"
        >
          <div className="flex w-full max-w-[360px] flex-col gap-5 rounded-[20px] bg-white p-8 text-center shadow-[0_20px_60px_rgba(30,26,20,0.25)]">
            <p className="text-lg font-bold text-[#1E1A14]">‘{deleteTarget.name}’ 프로필을 삭제하시겠습니까?</p>
            <p className="text-sm text-[#7A7268]">지금까지의 학습 기록도 함께 삭제되며 되돌릴 수 없습니다.</p>
            {deleteError && <p className="text-sm font-semibold text-berry">{deleteError}</p>}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="h-12 rounded-xl border border-[#E8E2DA] bg-[#F7F6F3] text-[15px] font-bold text-[#1E1A14] active:opacity-80"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  setDeleteError(null);
                  try {
                    await requestJson(`/api/profiles/${deleteTarget.id}`, { method: 'DELETE' }, DELETE_ERROR);
                    setDeleteTarget(null);
                    router.refresh();
                  } catch (e) {
                    setDeleteError(e instanceof Error ? e.message : DELETE_ERROR); // 실패 → 팝업 유지·재시도 가능
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="h-12 rounded-xl bg-berry text-[15px] font-bold text-white active:bg-ink disabled:opacity-60"
              >
                {deleting ? '삭제 중…' : '삭제하기'}
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomNav active="my" childId={null} />
    </div>
  );
}
