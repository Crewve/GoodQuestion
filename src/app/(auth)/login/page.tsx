// 로그인 화면 (T044, 기능명세서 1.1) — 서버 셸: 소셜 콜백 실패 쿼리(?error=social)만 읽어 내려준다.
// useSearchParams 클라이언트 훅 대신 서버 searchParams를 쓰면 Suspense 경계 없이 정적 빌드 이슈가 없다.
// 네이버 키(T082)는 서버 전용 env라 여기서 설정 여부만 내려준다 — 미설정 배포는 준비 중 안내 유지.
import { getNaverEnv } from '@/lib/auth/naver';
import { LoginScreen } from './login-screen';

export default async function LoginPage(props: PageProps<'/login'>) {
  const { error } = await props.searchParams;
  return <LoginScreen initialSocialError={error === 'social'} naverEnabled={getNaverEnv() !== null} />;
}
