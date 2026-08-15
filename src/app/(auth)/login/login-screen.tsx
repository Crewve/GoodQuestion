'use client';
// 로그인 화면 본체 (T044, 기능명세서 1.1.1 이메일 / 1.1.2 소셜) — 피그마 「개발 배포용」 1.1 로그인 대조 리뉴얼.
// 시안: 이메일 폼 + 구분선("또는") + 소셜 버튼이 한 카드에 동시 노출 → 기존 탭 전환(표시 전용)을 제거.
// 이메일: Supabase Auth signInWithPassword(브라우저 클라이언트 T010 재사용) → 성공 시 2.1 프로필 선택 이동.
// 에러 문구 3종(1.1.1 원문): 형식 오류는 클라이언트 검사, 미가입/비밀번호 오류는 Supabase가 같은
// invalid_credentials라 /auth/email-exists 프로브로 구분한다. 소셜은 카카오·구글 연동(T078 — R-10),
// 네이버는 Supabase 미지원이라 자체 OAuth 라우트(/auth/naver, T082)로 연동 — 버튼 배치는 피그마
// 코멘트 #115(카카오→네이버→구글 순). 키 미설정 배포에선 naverEnabled=false로 준비 중 안내 폴백.
// 카카오·구글은 PKCE 콜백(/auth/callback), 네이버는 /auth/naver/callback에서 세션 발급 후 복귀.
// 보호자 화면 — 스크롤 허용.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

/** 기능명세서 1.1.1 "~@~ 형식 필수" */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/;

const ERROR_EMAIL_NOT_FOUND = '가입하지 않은 이메일입니다';
const ERROR_WRONG_PASSWORD = '비밀번호를 다시 확인해주세요';
const ERROR_EMAIL_FORMAT = '올바른 이메일 형식을 입력해주세요';
const ERROR_SOCIAL = '소셜 로그인에 실패했습니다';
const NAVER_PENDING = '네이버 로그인은 아직 준비 중이에요';

// 시안 입력 필드: h50 · r14 · bg Base · border #F0E4D3, 포커스 시 primary
const inputClass =
  'h-[50px] w-full rounded-[14px] border border-[#F0E4D3] bg-background px-4 text-base text-ink outline-none placeholder:text-ink/50 focus:border-primary';

export function LoginScreen({
  initialSocialError,
  naverEnabled,
}: {
  initialSocialError: boolean;
  naverEnabled: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [socialError, setSocialError] = useState<boolean>(initialSocialError);
  const [naverPending, setNaverPending] = useState(false);
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
    setNaverPending(false);
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      // 보호 경로로 직접 돌아오면 proxy가 code를 유실시킴 — 공개 콜백에서 교환 후 이동 (auth/callback)
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/profiles` },
    });
    if (error) setSocialError(true); // 실패 → 현재 화면 유지, 버튼 재클릭으로 재시도 (1.1.2)
  };

  return (
    <main className="flex min-h-dvh flex-col items-center bg-[#F2EFE8] px-6 py-9">
      {/* 상단 로고 + 태그라인 (시안: 192×80 로고, 14px 태그라인) */}
      <h1 className="flex flex-col items-center gap-1">
        <Image
          src="/goodquestion-logo.png"
          alt="굿퀘스천"
          width={192}
          height={80}
          priority
          className="h-20 w-auto object-contain"
        />
        <span className="text-sm font-bold text-[#8A7A68]">대화로 키우는 말하기와 사고력</span>
      </h1>

      {/* 로그인 카드 — 480px · r24 · bg Base · 소프트 섀도 */}
      <section className="mt-7 w-full max-w-[480px] rounded-3xl bg-background p-8 shadow-[0_4px_32px_rgba(58,44,30,0.10)]">
        <h2 className="text-xl font-bold text-ink">로그인</h2>

        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleEmailLogin();
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
            이메일
            <input
              type="email"
              autoComplete="email"
              placeholder="이메일을 입력해주세요"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={`${inputClass} font-normal`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
            비밀번호
            <input
              type="password"
              autoComplete="current-password"
              placeholder="비밀번호를 입력해주세요"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={`${inputClass} font-normal`}
            />
          </label>

          {emailError && (
            <p className="text-sm font-semibold text-berry" role="alert">
              {emailError}
            </p>
          )}

          {/* 1.1.1 유효성 "비밀번호 | 1자 이상, 공백 불가" — 가입 규칙(validatePassword)과 동일하게 공백 포함 차단 */}
          <button
            type="submit"
            disabled={submitting || !email.trim() || password.length < 1 || /\s/.test(password)}
            className="mt-2 h-13 rounded-full bg-primary text-base font-bold text-white shadow-[0_6px_20px_rgba(255,122,61,0.33)] active:bg-ink disabled:opacity-40 disabled:shadow-none"
          >
            {submitting ? '로그인 중…' : '로그인하기'}
          </button>
        </form>

        {/* 구분선 — 시안 "또는" */}
        <div className="my-5 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-[#F0E4D3]" />
          <span className="text-[13px] font-bold text-[#8A7A68]">또는</span>
          <span className="h-px flex-1 bg-[#F0E4D3]" />
        </div>

        {/* 소셜 로그인 — 카카오·구글 (1.1.2, T078 — 시안 배치·버튼 스타일 유지) */}
        {socialError && (
          <p className="mb-3 text-sm font-semibold text-berry" role="alert">
            {ERROR_SOCIAL}
          </p>
        )}
        {naverPending && (
          <p className="mb-3 text-sm font-semibold text-berry" role="alert">
            {NAVER_PENDING}
          </p>
        )}
        <button
          type="button"
          onClick={() => void handleSocialLogin('kakao')}
          className="flex h-13 w-full items-center justify-center gap-2 rounded-[14px] bg-[#fee500] text-[15px] font-bold text-[#191919] active:opacity-80"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden>
            <path d="M9 1C4.58 1 1 3.83 1 7.32c0 2.24 1.47 4.2 3.69 5.32l-.94 3.5c-.08.31.27.56.54.38l4.13-2.76c.19.01.38.02.58.02 4.42 0 8-2.83 8-6.32S13.42 1 9 1Z" />
          </svg>
          카카오 로그인
        </button>
        {/* 네이버 — 자체 OAuth 라우트(T082)로 전체 페이지 이동. 키 미설정이면 준비 중 안내 폴백 */}
        <button
          type="button"
          onClick={() => {
            setSocialError(false);
            if (!naverEnabled) {
              setNaverPending(true);
              return;
            }
            setNaverPending(false);
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 페이지가 아닌 라우트 핸들러 → 네이버 외부 이동, 전체 페이지 내비게이션 필수
            window.location.assign('/auth/naver?next=/profiles');
          }}
          className="mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-[14px] bg-[#03C75A] text-[15px] font-bold text-white active:opacity-80"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M16.3 0v10.9L7.7 0H0v24h7.7V13.1L16.3 24H24V0z" />
          </svg>
          네이버 로그인
        </button>
        <button
          type="button"
          onClick={() => void handleSocialLogin('google')}
          className="mt-3 flex h-13 w-full items-center justify-center gap-2 rounded-[14px] border border-[#747775] bg-white text-[15px] font-bold text-[#1f1f1f] active:opacity-80"
        >
          {/* 구글 공식 G 로고 — fill 명시라 강제 다크 반전에도 식별 유지 */}
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
          구글 로그인
        </button>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-sm font-bold text-[#8A7A68]">
          아직 계정이 없으신가요?
          {/* 히트 영역을 글자 박스 전체(48px)로 — 여백 클릭이 먹지 않던 문제 (수정사항 C7 / QA 34).
              음수 마진으로 시각 위치는 그대로 두고 탭 영역만 넓힌다 */}
          <Link href="/signup" className="-my-3 flex min-h-12 items-center px-1 font-bold text-primary active:opacity-70">
            회원가입
          </Link>
        </p>
      </section>
    </main>
  );
}
