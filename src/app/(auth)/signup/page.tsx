'use client';
// T045 회원가입 2단계 화면 (기능명세서 1.2.1 계정 생성 · 1.2.2 아이 프로필 추가)
// 피그마 「개발 배포용」 1.2.1/1.2.2 대조 리뉴얼 — 로고 + 흰 카드(520px) + 단계 세그먼트 헤더 + 하단 버튼 바.
// - 순차 진행형: 인디케이터 클릭 이동 불가, 1단계 유효성 통과 시에만 2단계 진입.
// - 휴대폰 SMS 인증(시안 존재)은 MVP 범위 축소로 미배치 (R-10 — 기획 공유 완료). 약관 "보기" 링크도 문서
//   화면 미구현으로 미배치.
// - 최종 처리: Supabase Auth signUp → POST /api/profiles(T046)로 parents/children/child_consents 기록.
// - 검증 규칙·문구는 src/lib/auth/signup-validation.ts (테스트 동반) 단일 소스.
import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { LockIcon } from '@/components/icons';
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

// 아바타 4종 — 시안 원형 칩: 파스텔 배경 + 선택 시 캐릭터별 색 테두리·글로우
// (시안에 선택 상태가 있는 아바타1=primary·아바타2=sky 기준, 3·4는 배경 톤에 맞춰 sage·berry로 확장)
const AVATARS: {
  key: AvatarKey;
  label: string; // aria 라벨 (기존 유지)
  display: string; // 시안 표기
  bg: string;
  selected: string;
}[] = [
  { key: 'boy-1', label: '남자아이 1', display: '아바타1', bg: 'bg-[#FFEDE3]', selected: 'border-primary shadow-[0_4px_15px_rgba(255,122,61,0.33)]' },
  { key: 'boy-2', label: '남자아이 2', display: '아바타2', bg: 'bg-[#DDF0FB]', selected: 'border-sky shadow-[0_4px_15px_rgba(79,169,232,0.33)]' },
  { key: 'girl-1', label: '여자아이 1', display: '아바타3', bg: 'bg-[#DDF5EC]', selected: 'border-sage shadow-[0_4px_15px_rgba(61,190,139,0.33)]' },
  { key: 'girl-2', label: '여자아이 2', display: '아바타4', bg: 'bg-[#FDDCEF]', selected: 'border-berry shadow-[0_4px_15px_rgba(242,98,160,0.33)]' },
];

const MAX_CHILDREN = 3;

const STEP_LABELS = ['① 계정 생성', '② 아이 프로필 등록'] as const;

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
    <main className="flex min-h-dvh flex-col items-center bg-[#F2EFE8] px-5 py-8">
      <Image
        src="/goodquestion-logo.png"
        alt="굿퀘스천"
        width={192}
        height={80}
        priority
        className="h-20 w-auto object-contain"
      />

      {/* 카드 — 520px · r24 · 흰 배경 + 소프트 섀도 */}
      <div className="mt-6 w-full max-w-[520px] overflow-hidden rounded-3xl bg-white shadow-[0_4px_32px_rgba(58,44,30,0.10)]">
        {/* 진행 단계 세그먼트 — 표시 전용, 클릭 이동 불가 (순차 진행형) */}
        <ol className="flex" aria-label="회원가입 진행 단계">
          {STEP_LABELS.map((label, i) => {
            const active = step === i + 1;
            return (
              <li
                key={label}
                aria-current={active ? 'step' : undefined}
                className={`flex h-13 flex-1 items-center justify-center text-center text-sm ${
                  active
                    ? 'border border-primary bg-[#FFEDE3] font-bold text-primary'
                    : 'border-b border-[#F0E4D3] bg-[#F7F6F3] text-[#8A7A68]'
                }`}
              >
                {label}
              </li>
            );
          })}
        </ol>

        {step === 1 ? (
          <section className="flex flex-col gap-4 p-6" aria-label="1단계 계정 생성">
            <h1 className="text-lg font-bold text-ink">회원가입</h1>

            <Field label="이메일" error={emailError}>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailDupError(false);
                }}
                onBlur={() => markTouched('email')}
                placeholder="예: goodquestion@email.com"
                autoComplete="email"
                className={inputClass(!!emailError)}
              />
            </Field>

            <Field
              label="비밀번호"
              error={passwordError}
              hint="영문, 숫자, 특수문자를 포함해 8~20자로 입력해주세요"
            >
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => markTouched('password')}
                  placeholder="예: Good1234!"
                  autoComplete="new-password"
                  className={`${inputClass(!!passwordError)} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-ink/40"
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
                placeholder="비밀번호를 다시 입력해주세요"
                autoComplete="new-password"
                className={inputClass(!!confirmError)}
              />
            </Field>

            {/* 약관 동의 — 전체 동의는 하위 전체 토글 */}
            <div className="mt-1 border border-[#F0E4D3] p-4">
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={agreeAll}
                  onChange={toggleAgreeAll}
                  className="size-5 accent-primary"
                />
                <span className="text-[15px] font-bold text-ink">전체 동의하기</span>
              </label>

              <div className="mt-2 flex flex-col gap-3.5 border-t border-[#F0E4D3] pt-4">
                {/* [필수] 이용약관·개인정보 */}
                <label className="flex cursor-pointer items-start gap-2.5 rounded-[14px] border border-[#F0E4D3] bg-[#FFF8EE] p-4">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={() => setAgreeTerms((v) => !v)}
                    className="mt-0.5 size-4.5 shrink-0 accent-primary"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-[#FFEDE3] px-1.5 py-0.5 text-xs font-bold text-primary">
                        필수
                      </span>
                      <span className="text-sm font-bold text-ink">
                        이용약관 및 개인정보 처리방침 동의
                      </span>
                    </span>
                    <span className="text-[13px] text-[#8A7A68]">
                      서비스 이용을 위해 필수 약관에 동의해주세요
                    </span>
                  </span>
                </label>

                {/* [선택] 마케팅 */}
                <label className="flex cursor-pointer items-start gap-2.5 rounded-[14px] border border-[#F0E4D3] bg-[#FFF8EE] p-4">
                  <input
                    type="checkbox"
                    checked={agreeMarketing}
                    onChange={() => setAgreeMarketing((v) => !v)}
                    className="mt-0.5 size-4.5 shrink-0 accent-primary"
                  />
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-[#FFF5D4] px-1.5 py-0.5 text-xs font-bold text-sunny">
                      선택
                    </span>
                    <span className="text-sm font-bold text-ink">
                      마케팅 및 광고성 정보 수신 동의
                    </span>
                  </span>
                </label>
              </div>
            </div>
          </section>
        ) : (
          <section className="flex flex-col gap-5 p-6" aria-label="2단계 아이 프로필 등록">
            <h1 className="text-lg font-bold text-ink">
              함께 이야기를 배울 아이들의 정보를 알려주세요
            </h1>

            {/* 등록한 아이 칩 — 자유 전환형, 선택 칩 배경 채움 */}
            <div>
              <p className="mb-2 text-sm font-bold text-ink">등록한 아이</p>
              <div className="flex flex-wrap items-center gap-2.5">
                {children.map((child, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setActiveIdx(i);
                      setStep2Alert(null);
                    }}
                    className={`h-11 rounded-full px-4 text-sm font-bold ${
                      i === activeIdx
                        ? 'bg-primary text-white'
                        : 'border border-[#C9C9C9] bg-white text-ink'
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
                  className="h-11 rounded-full border border-[#C9C9C9] bg-white px-4 text-sm font-bold text-ink disabled:border-ink/15 disabled:text-ink/30"
                >
                  + 아이 추가하기
                </button>
              </div>
            </div>

            {/* 캐릭터 선택 — 단일 선택, 선택 시 캐릭터색 테두리·글로우 (시안 원형 칩) */}
            <Field label="캐릭터 선택" error={activeErrors?.avatar ?? null}>
              <div className="grid grid-cols-4 gap-2.5">
                {AVATARS.map(({ key, label, display, bg, selected }) => {
                  const isSelected = activeChild.avatar === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => updateActiveChild({ avatar: key })}
                      aria-pressed={isSelected}
                      aria-label={label}
                      className="flex flex-col items-center gap-1.5"
                    >
                      <span className="text-xs text-[#8A7A68]">{display}</span>
                      <span
                        className={`flex aspect-square w-full items-center justify-center overflow-hidden rounded-full border ${bg} ${
                          isSelected ? selected : 'border-transparent'
                        }`}
                      >
                        <Image
                          src={avatarUrl(key, 'select')}
                          alt=""
                          width={1052}
                          height={1008}
                          sizes="150px"
                          loading="eager"
                          className="size-[78%] object-contain"
                        />
                      </span>
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
                placeholder="아이 이름을 입력해주세요 (예: 홍길동)"
                className={inputClass(!!activeErrors?.name)}
              />
            </Field>

            <Field label="생년월일" error={activeErrors?.birthDate ?? null}>
              <input
                type="text"
                inputMode="numeric"
                value={activeChild.birthDate}
                onChange={(e) => updateActiveChild({ birthDate: sanitizeBirthDateInput(e.target.value) })}
                placeholder="생년월일을 입력해주세요 (예: 20190101)"
                className={inputClass(!!activeErrors?.birthDate)}
              />
            </Field>

            <hr className="border-[#F0E4D3]" />

            {/* 아동 동의 — 탭 무관 화면 공통 1회 (시안 민감정보 수집 동의 박스) */}
            <div className="rounded-2xl border border-[#FFE580] bg-[#FFF5D4] p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold text-[#B8763F]">
                <LockIcon className="size-4" />
                민감정보 수집 동의
              </p>
              <label className="mt-2.5 flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={childConsent}
                  onChange={() => {
                    setChildConsent((v) => !v);
                    setStep2Alert(null);
                  }}
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

            {(step2Alert || submitError) && (
              <p role="alert" className="text-sm font-semibold text-berry">
                {step2Alert ?? submitError}
              </p>
            )}
          </section>
        )}

        {/* 하단 버튼 바 — 시안 join bottom bar */}
        <div className="flex gap-3 border-t border-[#F0E4D3] bg-[#F2EFE8]/95 p-4">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="h-13 flex-1 rounded-full border border-[#F0E4D3] bg-white text-[15px] font-bold text-[#8A7A68]"
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
                className="h-13 flex-1 rounded-full bg-primary text-base font-bold text-white disabled:bg-[#C8BFAE]"
              >
                다음
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)} // 1단계 입력값은 state 유지
                className="h-13 flex-1 rounded-full border border-[#F0E4D3] bg-white text-[15px] font-bold text-[#8A7A68]"
              >
                이전
              </button>
              <button
                type="button"
                disabled={!signupEnabled}
                onClick={handleSignup}
                className="h-13 flex-1 rounded-full bg-primary text-base font-bold text-white disabled:bg-[#C8BFAE]"
              >
                {submitting ? '가입 중…' : '완료하기'}
              </button>
            </>
          )}
        </div>
      </div>
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
      <span className="text-sm font-bold text-ink">{label}</span>
      {children}
      {error ? (
        <p role="alert" className="text-[13px] text-berry">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-[#8A7A68]">{hint}</p>
      ) : null}
    </div>
  );
}

// 시안 입력 필드: h50 · r14 · bg Base(#FFF8EE) · border #F0E4D3, 포커스 시 primary
function inputClass(hasError: boolean): string {
  return `h-[50px] w-full rounded-[14px] border bg-[#FFF8EE] px-4 text-base text-ink outline-none placeholder:text-ink/40 focus:border-primary ${
    hasError ? 'border-berry' : 'border-[#F0E4D3]'
  }`;
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
