'use client';
// T045 회원가입 2단계 화면 (기능명세서 1.2.1 계정 생성 · 1.2.2 아이 프로필 추가)
// - 순차 진행형: 인디케이터 클릭 이동 불가, 1단계 유효성 통과 시에만 2단계 진입.
// - 휴대폰 SMS 인증은 MVP 범위 축소로 미배치 (R-10 — 기획 공유 완료).
// - 최종 처리: Supabase Auth signUp → POST /api/profiles(T046)로 parents/children/child_consents 기록.
// - 검증 규칙·문구는 src/lib/auth/signup-validation.ts (테스트 동반) 단일 소스.
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { avatarUrl, type AvatarKey } from '@/lib/assets';
import {
  MSG,
  firstInvalidChildIndex,
  isChildValid,
  isStep1Valid,
  sanitizeBirthDateInput,
  validateChild,
  validateEmail,
  validatePassword,
  validatePasswordConfirm,
  type ChildDraft,
} from '@/lib/auth/signup-validation';

const AVATARS: { key: AvatarKey; label: string }[] = [
  { key: 'boy-1', label: '남자아이 1' },
  { key: 'boy-2', label: '남자아이 2' },
  { key: 'girl-1', label: '여자아이 1' },
  { key: 'girl-2', label: '여자아이 2' },
];

const MAX_CHILDREN = 3;

function emptyChild(): ChildDraft {
  return { avatar: null, name: '', birthDate: '' };
}

/** 탭 표시명 — 이름 미입력 시 순번 라벨 (에러 문구 "OO(아이 이름)의 …"에도 사용) */
function childLabel(child: ChildDraft, index: number): string {
  return child.name.trim() || `아이${index + 1}`;
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  // ── 1단계: 계정 생성 ──────────────────────────────────────────
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false); // [필수] 이용약관·개인정보
  const [agreeMarketing, setAgreeMarketing] = useState(false); // [선택] 마케팅
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [emailDupError, setEmailDupError] = useState(false); // 서버 판정: 이미 가입한 이메일

  // ── 2단계: 아이 프로필 추가 ───────────────────────────────────
  const [children, setChildren] = useState<ChildDraft[]>([emptyChild()]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [childConsent, setChildConsent] = useState(false); // 화면 공통 1회 (탭 무관)
  const [erroredTabs, setErroredTabs] = useState<Set<number>>(new Set()); // 에러 노출 대상 탭
  const [step2Alert, setStep2Alert] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const emailError = emailDupError
    ? '이미 가입한 이메일입니다'
    : touched.email
      ? validateEmail(email)
      : null;
  const passwordError = touched.password ? validatePassword(password) : null;
  const confirmError = touched.confirm ? validatePasswordConfirm(password, passwordConfirm) : null;

  const step1Valid =
    isStep1Valid({ email, password, passwordConfirm, termsRequired: agreeTerms }) && !emailDupError;

  const agreeAll = agreeTerms && agreeMarketing;
  const toggleAgreeAll = () => {
    const next = !agreeAll;
    setAgreeTerms(next);
    setAgreeMarketing(next);
  };

  const activeChild = children[activeIdx];
  const activeErrors = erroredTabs.has(activeIdx) ? validateChild(activeChild) : null;
  const allChildrenValid = firstInvalidChildIndex(children) === -1;
  const signupEnabled = allChildrenValid && childConsent && !submitting;

  const updateActiveChild = (patch: Partial<ChildDraft>) => {
    setChildren((prev) => prev.map((c, i) => (i === activeIdx ? { ...c, ...patch } : c)));
    setStep2Alert(null);
  };

  /** 아이 추가하기 — 현재 탭 필수 항목만 검사(동의 제외), 통과 시에만 새 탭 생성·전환 */
  const handleAddChild = () => {
    if (children.length >= MAX_CHILDREN) return;
    if (!isChildValid(activeChild)) {
      setErroredTabs((prev) => new Set(prev).add(activeIdx));
      setStep2Alert(`${childLabel(activeChild, activeIdx)}의 필수 정보를 먼저 입력해주세요`);
      return;
    }
    setChildren((prev) => [...prev, emptyChild()]);
    setActiveIdx(children.length);
    setStep2Alert(null);
  };

  /** 회원가입 최종 처리 — 전체 탭 + 공통 동의 검사 → Auth 계정 생성 → 프로필 저장(T046) */
  const handleSignup = async () => {
    const invalidIdx = firstInvalidChildIndex(children);
    if (invalidIdx !== -1) {
      // 버튼 비활성으로 보통 도달하지 않는 방어 경로 — 오류 탭 자동 전환 (1.2.2)
      setActiveIdx(invalidIdx);
      setErroredTabs((prev) => new Set(prev).add(invalidIdx));
      setStep2Alert(`${childLabel(children[invalidIdx], invalidIdx)}의 정보를 확인해주세요`);
      return;
    }
    if (!childConsent) {
      setStep2Alert(MSG.CHILD_CONSENT);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    const supabase = getSupabaseBrowser();
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });

    // 중복 가입: 에러 코드 또는 (이메일 확인 활성 프로젝트의) identities 빈 배열 응답
    const isDuplicate = error
      ? error.code === 'user_already_exists' || /already registered/i.test(error.message)
      : (data.user?.identities?.length ?? 0) === 0;
    if (error || isDuplicate) {
      if (isDuplicate) {
        setEmailDupError(true);
        setStep(1);
      } else {
        setSubmitError('회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
      setSubmitting(false);
      return;
    }

    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        children: children.map((c) => ({
          name: c.name.trim(),
          avatar_key: c.avatar,
          birth_date: c.birthDate,
        })),
        child_consent: true,
      }),
    }).catch(() => null);

    if (!res?.ok) {
      setSubmitError('프로필 저장에 실패했습니다. 다시 시도해주세요.');
      setSubmitting(false);
      return;
    }
    router.replace('/profiles'); // 성공 → 2.1 아이 프로필 선택
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      <h1 className="text-center font-display text-2xl text-ink">회원가입</h1>

      {/* 진행 단계 인디케이터 — 표시 전용, 클릭 이동 불가 (순차 진행형) */}
      <ol className="flex gap-2" aria-label="회원가입 진행 단계">
        {(['계정 생성', '아이 프로필 등록'] as const).map((label, i) => {
          const active = step === i + 1;
          return (
            <li
              key={label}
              aria-current={active ? 'step' : undefined}
              className={`flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-semibold ${
                active ? 'bg-primary text-ink' : 'border border-ink/20 text-ink/50'
              }`}
            >
              {i + 1}. {label}
            </li>
          );
        })}
      </ol>

      {step === 1 ? (
        <section className="flex flex-col gap-5" aria-label="1단계 계정 생성">
          <Field label="이메일" error={emailError}>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailDupError(false);
              }}
              onBlur={() => markTouched('email')}
              placeholder="example@email.com"
              autoComplete="email"
              className={inputClass(!!emailError)}
            />
          </Field>

          <Field label="비밀번호" error={passwordError} hint="영문, 숫자, 특수문자를 포함해 8~20자">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => markTouched('password')}
                autoComplete="new-password"
                className={`${inputClass(!!passwordError)} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink/50"
              >
                <EyeIcon off={!showPassword} />
              </button>
            </div>
          </Field>

          <Field label="비밀번호 확인" error={confirmError}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              onBlur={() => markTouched('confirm')}
              autoComplete="new-password"
              className={inputClass(!!confirmError)}
            />
          </Field>

          {/* 약관 동의 — 전체 동의는 하위 전체 토글 */}
          <div className="rounded-2xl border border-ink/15 p-4">
            <CheckRow checked={agreeAll} onToggle={toggleAgreeAll} bold label="전체 동의하기" />
            <div className="mt-3 flex flex-col gap-2 border-t border-ink/10 pt-3">
              <CheckRow
                checked={agreeTerms}
                onToggle={() => setAgreeTerms((v) => !v)}
                label="[필수] 이용약관 및 개인정보 처리방침 동의"
              />
              <CheckRow
                checked={agreeMarketing}
                onToggle={() => setAgreeMarketing((v) => !v)}
                label="[선택] 마케팅 및 광고성 정보 수신 동의"
              />
            </div>
          </div>

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="h-13 flex-1 rounded-2xl border border-ink/20 font-semibold text-ink"
            >
              취소하기
            </button>
            <button
              type="button"
              disabled={!step1Valid}
              onClick={() => {
                setTouched({ email: true, password: true, confirm: true });
                if (step1Valid) setStep(2);
              }}
              className="h-13 flex-1 rounded-2xl bg-primary font-semibold text-white disabled:bg-ink/15 disabled:text-ink/40"
            >
              다음
            </button>
          </div>
        </section>
      ) : (
        <section className="flex flex-col gap-5" aria-label="2단계 아이 프로필 등록">
          {/* 등록한 아이 탭 — 자유 전환형, 선택 탭 배경 채움 */}
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">등록한 아이</p>
            <div className="flex gap-2">
              {children.map((child, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setActiveIdx(i);
                    setStep2Alert(null);
                  }}
                  className={`h-11 flex-1 rounded-xl text-sm font-semibold ${
                    i === activeIdx ? 'bg-primary text-white' : 'border border-ink/20 text-ink/60'
                  }`}
                >
                  {childLabel(child, i)}
                </button>
              ))}
              <button
                type="button"
                onClick={handleAddChild}
                disabled={children.length >= MAX_CHILDREN}
                title={children.length >= MAX_CHILDREN ? '아이는 최대 3명까지 등록할 수 있어요' : undefined}
                className="h-11 flex-1 rounded-xl border border-dashed border-primary text-sm font-semibold text-primary disabled:border-ink/15 disabled:text-ink/30"
              >
                + 아이 추가하기
              </button>
            </div>
          </div>

          {/* 캐릭터 선택 — 단일 선택, 선택 시 테두리 표시 */}
          <Field label="캐릭터 선택" error={activeErrors?.avatar ?? null}>
            <div className="grid grid-cols-4 gap-2">
              {AVATARS.map(({ key, label }) => {
                const selected = activeChild.avatar === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => updateActiveChild({ avatar: key })}
                    aria-pressed={selected}
                    aria-label={label}
                    className={`overflow-hidden rounded-2xl border-4 ${
                      selected ? 'border-primary' : 'border-transparent'
                    }`}
                  >
                    <Image
                      src={avatarUrl(key, 'select')}
                      alt=""
                      width={1052}
                      height={1008}
                      sizes="150px"
                      loading="eager"
                      className="aspect-square w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="아이 이름" error={activeErrors?.name ?? null}>
            <input
              type="text"
              value={activeChild.name}
              onChange={(e) => updateActiveChild({ name: e.target.value })}
              placeholder="이름을 입력해주세요"
              className={inputClass(!!activeErrors?.name)}
            />
          </Field>

          <Field label="생년월일" error={activeErrors?.birthDate ?? null}>
            <input
              type="text"
              inputMode="numeric"
              value={activeChild.birthDate}
              onChange={(e) => updateActiveChild({ birthDate: sanitizeBirthDateInput(e.target.value) })}
              placeholder="8자리 입력 (예: 20190101)"
              className={inputClass(!!activeErrors?.birthDate)}
            />
          </Field>

          {/* 아동 동의 — 탭 무관 화면 공통 1회 */}
          <div className="rounded-2xl border border-ink/15 p-4">
            <CheckRow
              checked={childConsent}
              onToggle={() => {
                setChildConsent((v) => !v);
                setStep2Alert(null);
              }}
              label="[필수] 아동 개인정보 수집·이용 동의"
            />
          </div>

          {(step2Alert || submitError) && (
            <p role="alert" className="text-sm font-semibold text-berry">
              {step2Alert ?? submitError}
            </p>
          )}

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)} // 1단계 입력값은 state 유지
              className="h-13 flex-1 rounded-2xl border border-ink/20 font-semibold text-ink"
            >
              이전
            </button>
            <button
              type="button"
              disabled={!signupEnabled}
              onClick={handleSignup}
              className="h-13 flex-1 rounded-2xl bg-primary font-semibold text-white disabled:bg-ink/15 disabled:text-ink/40"
            >
              {submitting ? '가입 중…' : '회원가입'}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

/** 라벨 + 입력 + (힌트/에러) 공통 래퍼 — 에러 문구는 기능명세서 문구 그대로 노출 */
function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error: string | null;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-berry">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-ink/40">{hint}</p>
      ) : null}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return `h-13 w-full rounded-2xl border bg-white px-4 text-base text-ink outline-none placeholder:text-ink/30 focus:border-primary ${
    hasError ? 'border-berry' : 'border-ink/20'
  }`;
}

function CheckRow({
  checked,
  onToggle,
  label,
  bold = false,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  bold?: boolean;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3">
      <input type="checkbox" checked={checked} onChange={onToggle} className="size-5 accent-[#ff7a3d]" />
      <span className={`text-[15px] text-ink ${bold ? 'font-bold' : ''}`}>{label}</span>
    </label>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <line x1="4" y1="20" x2="20" y2="4" />}
    </svg>
  );
}
