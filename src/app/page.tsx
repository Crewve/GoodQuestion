// 루트 진입 분기 (T066, E2E 항목 31·9) — 전용 화면 없이 세션 유무로 즉시 리다이렉트.
// proxy.ts 보호 프리픽스에 '/'가 없어 루트만 뚫려 있던 것을 여기서 막는다
// (IA 흐름: 1.1 로그인 → 1.3 아이 프로필 선택 → 홈).
import { redirect } from 'next/navigation';
import { getAuthedUser } from '@/lib/supabase-server';

export default async function RootPage() {
  const user = await getAuthedUser();
  redirect(user ? '/profiles' : '/login');
}
