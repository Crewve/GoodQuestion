'use client';
// 로그인 화면 본체 (T044, 기능명세서 1.1.1 이메일 / 1.1.2 소셜) — 탭 자유 전환, 입력값은 전환해도 유지.
// 이메일: Supabase Auth signInWithPassword(브라우저 클라이언트 T010 재사용) → 성공 시 2.1 프로필 선택 이동.
// 에러 문구 3종(1.1.1 원문): 형식 오류는 클라이언트 검사, 미가입/비밀번호 오류는 Supabase가 같은
// invalid_credentials라 /auth/email-exists 프로브로 구분한다. 소셜은 카카오+구글(T078 — R-10 대체 플랜 실행),
// PKCE 콜백(/auth/callback)에서 세션 교환 후 복귀. 보호자 화면 — Pretendard·16px·터치 48px+(핸드오프 §3.3·§4).
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

/** 기능명세서 1.1.1 "~@~ 형식 필수" */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

const ERROR_EMAIL_NOT_FOUND = '가입하지 않은 이메일입니다';
const ERROR_WRONG_PASSWORD = '비밀번호를 다시 확인해주세요';
const ERROR_EMAIL_FORMAT = '올바른 이메일 형식을 입력해주세요';
const ERROR_SOCIAL = '소셜 로그인에 실패했습니다';

type Tab = 'email' | 'social';

const tabClass = (active: boolean) =>
  `h-12 flex-1 rounded-full text-base font-semibold transition-colors ${
    active ? 'bg-primary text-white' : 'bg-white text-ink'
  }`;

const inputClass =
  'h-12 w-full rounded-2xl border-2 border-white bg-white px-4 text-base text-ink outline-none focus:border-primary';

export function LoginScreen({ initialSocialError }: { initialSocialError: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<boolean>(initialSocialError);
  const [submitting, setSubmitting] = useState(false);

  const handleEmailLogin = async () => {
    if (submitting) return;
    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError(ERROR_EMAIL_FORMAT); // 실패 → 현재 화면 유지, 이메일 재입력 (1.1.1)
      return;
    }
    setEmailError(null);
    setSubmitting(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (!error) {
        router.replace('/profiles'); // 성공 → 2.1 아이 프로필 선택 (1.1.1 화면 이동)
        return;
      }
      // 미가입/비밀번호 오류 구분 — 프로브 실패 시엔 일반 문구(비밀번호) 쪽으로 폴백
      let exists = true;
      try {
        const res = await fetch('/auth/email-exists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (res.ok) exists = ((await res.json()) as { exists: boolean }).exists;
      } catch {
        // 프로브 불가 — exists 기본값 유지
      }
      setEmailError(exists ? ERROR_WRONG_PASSWORD : ERROR_EMAIL_NOT_FOUND);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSocialLogin = async (provider: 'kakao' | 'google') => {
    setSocialError(false);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      // 보호 경로로 직접 돌아오면 proxy가 code를 유실시킴 — 공개 콜백에서 교환 후 이동 (auth/callback)
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/profiles` },
    });
    if (error) setSocialError(true); // 실패 → 현재 화면 유지, 버튼 재클릭으로 재시도 (1.1.2)
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-6 py-10">
      <h1 className="font-display text-4xl text-primary">굿퀘스천</h1>

      <section className="flex w-full max-w-md flex-col gap-5">
        {/* 탭 전환 — 이메일(1.1.1) ↔ 소셜(1.1.2) 자유 전환 */}
        <div className="flex gap-2 rounded-full bg-white/60 p-1" role="tablist" aria-label="로그인 방법">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'email'}
            onClick={() => setTab('email')}
            className={tabClass(tab === 'email')}
          >
            이메일 로그인
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'social'}
            onClick={() => setTab('social')}
            className={tabClass(tab === 'social')}
          >
            소셜 로그인
          </button>
        </div>

        {tab === 'email' ? (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleEmailLogin();
            }}
          >
            <label className="flex flex-col gap-1 text-base text-ink">
              이메일
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-base text-ink">
              비밀번호
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={inputClass}
              />
            </label>

            {emailError && (
              <p className="text-base font-semibold text-primary" role="alert">
                {emailError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !email.trim() || password.length < 1}
              className="h-12 rounded-full bg-primary text-base font-bold text-white active:bg-ink disabled:opacity-40"
            >
              {submitting ? '로그인 중…' : '로그인'}
            </button>

            <p className="mt-2 flex items-center justify-center gap-2 text-base text-ink">
              아직 계정이 없으신가요?
              <Link href="/signup" className="font-bold text-primary underline">
                회원가입
              </Link>
            </p>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            {socialError && (
              <p className="text-base font-semibold text-primary" role="alert">
                {ERROR_SOCIAL}
              </p>
            )}
            <button
              type="button"
              onClick={() => void handleSocialLogin('kakao')}
              className="h-12 rounded-full bg-[#fee500] text-base font-bold text-[#191919] active:opacity-80"
            >
              카카오로 시작하기
            </button>
            <button
              type="button"
              onClick={() => void handleSocialLogin('google')}
              className="flex h-12 items-center justify-center gap-2 rounded-full border-2 border-[#747775] bg-white text-base font-bold text-[#1f1f1f] active:opacity-80"
            >
              {/* 구글 공식 G 로고 — fill 명시라 강제 다크 반전에도 식별 유지 */}
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              구글로 시작하기
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
