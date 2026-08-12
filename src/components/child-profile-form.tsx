'use client';
// 아이 프로필 추가 폼 (T047, 기능명세서 2.1.1) — 캐릭터 4종·이름·생년월일 8자리·아동 동의 1회.
// 2.1.1(1명씩 재진입)과 1.2.2(회원가입 탭 다중 등록, 동의는 화면 1회)가 필드 구성을 공유하므로
// 화면 정책(동의 노출·버튼 라벨)은 props로 흡수한다 — T045(파트2)가 회원가입에서 재사용하는 합류 지점.
// 완료하기는 필수 필드+동의 채움 시 활성(구성요소 표), 클릭 시 전체 검증(검증 시점 규칙) — 날짜 유효성은
// 클릭 시에만 판정한다. 생년월일은 숫자 외 입력 즉시 필터링(별도 에러 없음 — 2.1.1 예외 처리).
import { useState } from 'react';
import { avatarUrl, type AvatarKey } from '@/lib/assets';
import { isValidBirthDate } from '@/lib/profile-display';

const AVATAR_KEYS: AvatarKey[] = ['boy-1', 'boy-2', 'girl-1', 'girl-2'];

// 기능명세서 2.1.1 예외 처리 문구 원문
const ERROR_NO_AVATAR = '캐릭터를 선택해주세요';
const ERROR_NO_NAME = '아이 이름을 입력해주세요';
const ERROR_BIRTH_LENGTH = '생년월일 8자리를 입력해주세요 (예: 20190101)';
const ERROR_BIRTH_INVALID = '올바른 생년월일을 입력해주세요';
const ERROR_NO_CONSENT = '필수 약관에 동의해주세요';

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
      className="flex w-full max-w-md flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-base font-semibold text-ink">캐릭터 선택</legend>
        <div className="grid grid-cols-4 gap-3">
          {AVATAR_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={avatarKey === key}
              onClick={() => setAvatarKey(key)} // 단일 선택 — 기존 선택 해제 후 신규 적용
              className={`overflow-hidden rounded-2xl border-4 bg-white p-1 transition-colors ${
                avatarKey === key ? 'border-primary' : 'border-white'
              }`}
            >
              <img src={avatarUrl(key, 'select')} alt={`캐릭터 ${key}`} className="aspect-square w-full object-contain" />
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-base font-semibold text-ink">
        아이 이름
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-12 w-full rounded-2xl border-2 border-white bg-white px-4 text-base font-normal text-ink outline-none focus:border-primary"
        />
      </label>

      <label className="flex flex-col gap-1 text-base font-semibold text-ink">
        생년월일
        <input
          type="text"
          inputMode="numeric"
          placeholder="20190101"
          value={birthDigits}
          maxLength={8}
          onChange={(event) => setBirthDigits(event.target.value.replace(/\D/g, ''))} // 숫자 외 즉시 필터링
          className="h-12 w-full rounded-2xl border-2 border-white bg-white px-4 text-base font-normal text-ink outline-none focus:border-primary"
        />
      </label>

      {showConsent && (
        <label className="flex items-center gap-3 text-base text-ink">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            className="size-6 accent-primary"
          />
          [필수] 아동 개인정보 수집·이용 동의
        </label>
      )}

      {error && (
        <p className="text-base font-semibold text-primary" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 flex-1 rounded-full bg-white text-base font-bold text-ink active:bg-ink active:text-white"
        >
          취소하기
        </button>
        <button
          type="submit"
          disabled={!filled || submitting}
          className="h-12 flex-1 rounded-full bg-primary text-base font-bold text-white active:bg-ink disabled:opacity-40"
        >
          {submitting ? '등록 중…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
