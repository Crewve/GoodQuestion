// 아이 프로필 선택 화면 서버 셸 (T047, 기능명세서 2.1) — 읽기 데이터는 Server Component 직접 조회
// (contracts/api-routes.md "화면 데이터 조회" 방침). RLS 정책이 없어 브라우저 직조회 불가 —
// /api/sessions와 동일하게 인증 확인 후 admin 클라이언트를 보호자 소속으로 스코프해 읽는다.
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';
import { ProfilesScreen, type ChildProfile } from './profiles-screen';

export default async function ProfilesPage() {
  const user = await getAuthedUser();
  if (!user) redirect('/login'); // proxy가 1차 차단 — 직접 렌더 경로 이중 방어

  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from('children')
    .select('id, name, birth_date, avatar_key')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: true })
    .limit(3); // 최대 3명 (기능명세서 2.1 — 초과분은 앱 레벨에서 미노출)

  const profiles: ChildProfile[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    birthDate: (row.birth_date as string | null) ?? null,
    avatarKey: (row.avatar_key as string | null) ?? null,
  }));

  return <ProfilesScreen profiles={profiles} />;
}
