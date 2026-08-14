'use client';
// 아이 프로필 선택·추가 화면 본체 (T047, 기능명세서 2.1·2.1.1) — 피그마 「개발 배포용」 2.1/2.1.1 대조 리뉴얼.
// 2.1(아이 화면·스크롤 금지): 좌상단 로고 + 중앙 헤드라인 + 파스텔 카드(인덱스별 색 순환) + 아이 추가 카드(3명 시 숨김),
// 만 나이 배지(비정상 데이터 미표시), 카드 클릭 시 선택 링 표시 후 홈 진입(아이 컨텍스트 ?child=).
// 추가 폼은 별도 화면(2.1.1) 요건 — URL 추가 없이 화면 내 뷰 전환으로 구현(완료/취소 시 2.1 목록 복귀).
// 저장은 파트2 T046(/api/profiles) 합류 지점 — save-profile.ts 인터페이스만 호출, 미구현 동안 대기 안내.
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChildProfileForm } from '@/components/child-profile-form';
import { PlusCircleIcon, UserIcon } from '@/components/icons';
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

// 카드 색상 — 시안 2.1: 슬롯 순서대로 오렌지·써니·베리 파스텔 순환 (최대 3명 시안 실측)
// 배지 글자색은 스토리보드 실측 흰색으로 복귀(QA 13 "색상 기준은 스토리보드 기준으로") — 크기만 아동 하한
// 18px 유지(핸드오프 가이드 §3, 색이 아닌 별도 기준). Sunny 배지 위 흰 글자는 대비 1.7:1 미달 인지하고 채택.
const CARD_STYLES = [
  { card: 'bg-[#FFEDE3]', badge: 'bg-primary', glow: 'shadow-[0_6px_20px_rgba(255,122,61,0.25)]', spark: 'text-primary' },
  { card: 'bg-[#FFF5D4]', badge: 'bg-sunny', glow: 'shadow-[0_6px_20px_rgba(255,201,60,0.25)]', spark: 'text-sunny' },
  { card: 'bg-[#FDDCEF]', badge: 'bg-berry', glow: 'shadow-[0_6px_20px_rgba(242,98,160,0.25)]', spark: 'text-berry' },
] as const;

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
    // 2.1.1 — 시안: 흰 카드(520px) + 상단 스트립 헤더 + 폼 (보호자 조작 폼, 스크롤 허용)
    return (
      <main className="flex min-h-dvh flex-col items-center px-5 py-8">
        <div className="w-full max-w-[520px] overflow-hidden rounded-3xl bg-white shadow-[0_4px_32px_rgba(58,44,30,0.10)]">
          <h1 className="flex h-13 items-center justify-center border-b border-primary bg-[#FFEDE3] text-sm font-bold text-primary">
            아이 프로필 추가 등록
          </h1>
          <div className="flex flex-col items-center p-6">
            <p className="w-full max-w-md text-lg font-bold text-ink">
              함께 이야기를 배울 아이들의 정보를 알려주세요
            </p>
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
          </div>
        </div>
      </main>
    );
  }

  // 2.1 — 아이 화면: h-dvh 한 화면 수납, 스크롤 금지
  return (
    <main className="flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 items-center px-6 pt-4">
        <Image
          src="/goodquestion-logo.png"
          alt="굿퀘스천"
          width={192}
          height={80}
          priority
          className="h-14 w-auto object-contain"
        />
      </header>

      <div className="shrink-0 px-6 pt-5 text-center">
        <h1 className="font-display text-[2rem] leading-normal text-ink">오늘은 누가 이야기할까요?</h1>
        {/* 스토리보드 실측 #8A7A68 (Base 배경 대비 3.9:1 — QA 13 지시로 시안 원색 채택) */}
        <p className="mt-1 font-display text-lg text-[#8A7A68]">학습할 친구를 선택해 주세요.</p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-6 pb-8">
        {profiles.length === 0 && (
          <p className="font-display text-lg text-ink">아직 등록된 친구가 없어요</p>
        )}

        {/* 고정 4열 그리드는 아이가 1~2명일 때 빈 열 탓에 왼쪽 쏠림 — 내용 기준 중앙 정렬로 (E2E 항목 11 후속) */}
        <div className="flex w-full max-w-4xl flex-wrap justify-center gap-5">
          {profiles.map((profile, index) => {
            const age = koreanAge(profile.birthDate);
            const hasAvatar = !!profile.avatarKey && AVATAR_KEYS.has(profile.avatarKey);
            const style = CARD_STYLES[index % CARD_STYLES.length];
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => selectChild(profile.id)}
                className={`flex min-h-72 w-52 flex-col items-center justify-center gap-7 rounded-[28px] py-8 shadow-[0_4px_18px_rgba(58,44,30,0.10)] transition-shadow ${style.card} ${
                  selectedId === profile.id ? 'ring-4 ring-primary' : ''
                }`}
              >
                {/* 아바타 원형 + 반짝이 장식 (시안) */}
                <span className={`relative flex size-28 items-center justify-center rounded-full bg-white ${style.glow}`}>
                  {hasAvatar ? (
                    <Image
                      src={avatarUrl(profile.avatarKey as AvatarKey, 'select')}
                      alt=""
                      width={1052}
                      height={1008}
                      sizes="120px"
                      loading="eager"
                      className="size-[74%] object-contain"
                    />
                  ) : (
                    <UserIcon className="size-12 text-primary/70" />
                  )}
                  <span aria-hidden className="absolute -top-1.5 -right-1 font-display text-sm text-sunny">
                    ★
                  </span>
                  <span aria-hidden className={`absolute top-1 -left-1.5 font-display text-[10px] ${style.spark}`}>
                    ✦
                  </span>
                </span>

                <span className="flex items-center gap-2">
                  <span className="font-display text-2xl text-ink">{profile.name}</span>
                  {/* 계산값 0세 미만/150세 이상은 비정상 데이터 — 배지 미표시 (2.1 유효성) */}
                  {age !== null && (
                    <span className={`rounded-full px-3 py-0.5 text-lg font-bold text-white ${style.badge}`}>
                      만 {age}세
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {/* 아이 추가 카드 — 3명 도달 시 카드 자체 숨김 (2.1 구성요소) */}
          {profiles.length < 3 && (
            <button
              type="button"
              onClick={() => setView('add')}
              className="flex min-h-72 w-52 flex-col items-center justify-center gap-4 rounded-[28px] border border-[#F0E4D3] bg-white py-8"
            >
              <span
                aria-hidden
                // 스토리보드 PlusCircle: primary 채움 원형 글리프 (흰 배경 위 아이콘)
                className="flex size-16 items-center justify-center rounded-full text-primary"
              >
                <PlusCircleIcon className="size-16" />
              </span>
              <span className="flex flex-col items-center gap-1">
                {/* 스토리보드 실측: '아이 추가' primary · 보조 문구 #8A7A68 (QA 13) */}
                <span className="font-display text-xl text-primary">아이 추가</span>
                <span className="text-lg text-[#8A7A68]">새로운 친구를 추가해요.</span>
              </span>
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
