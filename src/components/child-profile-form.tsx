'use client';
// 아이 프로필 추가 폼 (T047, 기능명세서 2.1.1) — 캐릭터 4종·이름·생년월일 8자리·아동 동의 1회.
// 피그마 「개발 배포용」 2.1.1 대조 리뉴얼 — 아바타 원형 칩(파스텔 배경 + 선택 시 캐릭터색 테두리·글로우),
// r14 입력 필드, 민감정보 수집 동의 박스(옐로), 하단 취소/완료 버튼(비활성 #C8BFAE).
// 2.1.1(1명씩 재진입)과 3.2(프로필 관리 수정)가 필드 구성을 공유하므로
// 화면 정책(동의 노출·버튼 라벨)은 props로 흡수한다 — T045(파트2)가 회원가입에서 재사용하는 합류 지점.
// 완료하기는 필수 필드+동의 채움 시 활성(구성요소 표), 클릭 시 전체 검증(검증 시점 규칙) — 날짜 유효성은
// 클릭 시에만 판정한다. 생년월일은 숫자 외 입력 즉시 필터링(별도 에러 없음 — 2.1.1 예외 처리).
import { useState } from 'react';
import Image from 'next/image';
import { LockIcon } from '@/components/icons';
import { avatarUrl, type AvatarKey } from '@/lib/assets';
import { isValidBirthDate } from '@/lib/profile-display';

// 시안 원형 칩 — 선택 상태가 시안에 있는 아바타1=primary·아바타2=sky 기준, 3·4는 배경 톤에 맞춰 sage·berry로 확장
const AVATARS: { key: AvatarKey; display: string; bg: string; selected: string }[] = [
  { key: 'boy-1', display: '아바타1', bg: 'bg-[#FFEDE3]', selected: 'border-primary shadow-[0_4px_15px_rgba(255,122,61,0.33)]' },
  { key: 'boy-2', display: '아바타2', bg: 'bg-[#DDF0FB]', selected: 'border-sky shadow-[0_4px_15px_rgba(79,169,232,0.33)]' },
  { key: 'girl-1', display: '아바타3', bg: 'bg-[#DDF5EC]', selected: 'border-sage shadow-[0_4px_15px_rgba(61,190,139,0.33)]' },
  { key: 'girl-2', display: '아바타4', bg: 'bg-[#FDDCEF]', selected: 'border-berry shadow-[0_4px_15px_rgba(242,98,160,0.33)]' },
];

// 기능명세서 2.1.1 예외 처리 문구 원문
const ERROR_NO_AVATAR = '캐릭터를 선택해주세요';
const ERROR_NO_NAME = '아이 이름을 입력해주세요';
const ERROR_BIRTH_LENGTH = '생년월일 8자리를 입력해주세요 (예: 20190101)';
const ERROR_BIRTH_INVALID = '올바른 생년월일을 입력해주세요';
const ERROR_NO_CONSENT = '필수 약관에 동의해주세요';

// 시안 입력 필드: h50 · r14 · bg Base(#FFF8EE) · border #F0E4D3, 포커스 시 primary
const inputClass =
  'h-[50px] w-full rounded-[14px] border border-[#F0E4D3] bg-[#FFF8EE] px-4 text-base font-normal text-ink outline-none placeholder:text-ink/40 focus:border-primary';

export type ChildProfileFormValue = {
  name: string;
  /** YYYYMMDD 8자리 */
  birthDate: string;
  avatarKey: AvatarKey;
};

export type ChildProfileFormProps = {
  /** 저장 처리 — reject(Error) 시 message를 폼 에러로 표시하고 화면 유지 (실패 → 현재 화면 유지) */
  onSubmit: (value: ChildProfileFormValue) => Promise<void>;
  onCancel: () => void;
  /** 1.2.2 재사용 대비 — 동의를 화면 상위에서 1회만 받는 경우 false (기본 true, 2.1.1은 폼 안에서 1회) */
  showConsent?: boolean;
  submitLabel?: string;
  /** 수정 모드(3.2 프로필 관리) 초기값 — 지정 시 기존 값으로 시작 (등록 경로는 미지정, 동작 불변) */
  initialValue?: ChildProfileFormValue;
};

export function ChildProfileForm({
  onSubmit,
  onCancel,
  showConsent = true,
  submitLabel = '완료하기',
  initialValue,
}: ChildProfileFormProps) {
  const [avatarKey, setAvatarKey] = useState<AvatarKey | null>(initialValue?.avatarKey ?? null);
  const [name, setName] = useState(initialValue?.name ?? '');
  const [birthDigits, setBirthDigits] = useState(initialValue?.birthDate ?? '');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 완료하기 활성 조건 — 필수 필드·동의 채움 (2.1.1 구성요소 표). 날짜 유효성은 클릭 시 판정.
  const filled =
    !!avatarKey && name.trim().length >= 1 && birthDigits.length === 8 && (!showConsent || consent);

  const validate = (): string | null => {
    if (!avatarKey) return ERROR_NO_AVATAR;
    if (name.trim().length < 1) return ERROR_NO_NAME;
    if (birthDigits.length !== 8) return ERROR_BIRTH_LENGTH;
    if (!isValidBirthDate(birthDigits)) return ERROR_BIRTH_INVALID; // 달력에 없는 날짜·미래 날짜
    if (showConsent && !consent) return ERROR_NO_CONSENT;
    return null;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), birthDate: birthDigits, avatarKey: avatarKey! });
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록에 실패했어요. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      className="mt-5 flex w-full max-w-md flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-bold text-ink">캐릭터 선택</legend>
        <div className="grid grid-cols-4 gap-2.5">
          {AVATARS.map(({ key, display, bg, selected }) => (
            <button
              key={key}
              type="button"
              aria-pressed={avatarKey === key}
              onClick={() => setAvatarKey(key)} // 단일 선택 — 기존 선택 해제 후 신규 적용
              className="flex flex-col items-center gap-1.5"
            >
              <span className="text-xs text-[#8A7A68]">{display}</span>
              <span
                className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-full border transition-colors ${bg} ${
                  avatarKey === key ? selected : 'border-transparent'
                }`}
              >
                <Image
                  src={avatarUrl(key, 'select')}
                  alt={`캐릭터 ${key}`}
                  width={1052}
                  height={1008}
                  sizes="150px"
                  loading="eager"
                  className="size-[78%] object-contain"
                />
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
        아이 이름
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="아이 이름을 입력해주세요 (예: 홍길동)"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
        생년월일
        <input
          type="text"
          inputMode="numeric"
          placeholder="생년월일을 입력해주세요 (예: 20190101)"
          value={birthDigits}
          maxLength={8}
          onChange={(event) => setBirthDigits(event.target.value.replace(/\D/g, ''))} // 숫자 외 즉시 필터링
          className={inputClass}
        />
      </label>

      {showConsent && (
        <>
          <hr className="border-[#F0E4D3]" />

          {/* 시안 민감정보 수집 동의 박스 (옐로) */}
          <div className="rounded-2xl border border-[#FFE580] bg-[#FFF5D4] p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold text-[#B8763F]">
              <LockIcon className="size-4" />
              민감정보 수집 동의
            </p>
            <label className="mt-2.5 flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 size-4.5 shrink-0 accent-primary"
              />
              <span className="flex flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-[#FFE580] px-1.5 py-0.5 text-xs font-bold text-[#B8763F]">
                    필수
                  </span>
                  <span className="text-sm text-ink">아동 개인정보 수집·이용 동의</span>
                </span>
                <span className="text-[13px] leading-relaxed text-[#8A7A68]">
                  이 서비스는 만 14세 미만 아동의 개인정보를 수집합니다. 보호자가 아동을 대신하여 이
                  동의를 진행합니다. 수집 항목: 아이 이름(또는 닉네임), 출생연도, 학습 발화 기록
                </span>
              </span>
            </label>
          </div>
        </>
      )}

      {error && (
        <p className="text-sm font-semibold text-berry" role="alert">
          {error}
        </p>
      )}

      {/* 하단 버튼 바 — 시안: 취소(아웃라인) / 완료(비활성 #C8BFAE) */}
      <div className="flex gap-3 border-t border-[#F0E4D3] pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="h-13 flex-1 rounded-full border border-[#F0E4D3] bg-white text-[15px] font-bold text-ink/70 active:bg-[#F7F6F3]"
        >
          취소하기
        </button>
        <button
          type="submit"
          disabled={!filled || submitting}
          className="h-13 flex-1 rounded-full bg-primary text-base font-bold text-white active:bg-ink disabled:bg-[#C8BFAE]"
        >
          {submitting ? '등록 중…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
