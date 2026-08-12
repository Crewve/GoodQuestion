// 아이 프로필 관리 서버 셸 (T057, 기능명세서 3.2) — 읽기 데이터는 Server Component 직접 조회
// (2.1 선택 화면 T047과 동일 쿼리·동일 이중 방어). 목록·추가 상호작용은 manage-screen(클라이언트)이 담당.
import { redirect } from 'next/navigation';
import type { ChildProfile } from '@/app/profiles/profiles-screen';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';
import { ManageProfilesScreen } from './manage-screen';

export const dynamic = 'force-dynamic';

export default async function ManageProfilesPage() {
  const user = await getAuthedUser();
  if (!user) redirect('/login'); // proxy가 1차 차단 — 직접 렌더 경로 이중 방어

  const { data, error } = await getSupabaseAdmin()
    .from('children')
    .select('id, name, birth_date, avatar_key')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: true })
    .limit(3); // 최대 3명 (기능명세서 2.1·3.2 공통 — 초과분은 앱 레벨에서 미노출)
  if (error) throw new Error(`프로필 정보를 불러오지 못했습니다: ${error.message}`); // error.tsx 재시도 (3.2 예외 처리)

  const profiles: ChildProfile[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    birthDate: (row.birth_date as string | null) ?? null,
    avatarKey: (row.avatar_key as string | null) ?? null,
  }));

  return <ManageProfilesScreen profiles={profiles} />;
}
