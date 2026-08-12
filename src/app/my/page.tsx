// 내정보 서버 셸 (T056, 기능명세서 3.1) — 로그인 방식·아이 프로필 리스트(2.1/3.2와 동일 쿼리)·
// 이번 주 활동 요약을 Server Component에서 직접 조회해 클라이언트 화면(my-screen)에 내린다.
// 프로필 조회 실패는 throw → error.tsx "정보를 불러오지 못했습니다" 재시도, 학습 현황 조회 실패는
// summary=null로 내려 화면 유지 + "학습 정보를 불러오지 못했습니다" 재조회 (3.1 예외 처리 두 갈래).
import { redirect } from 'next/navigation';
import type { ChildProfile } from '@/app/profiles/profiles-screen';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';
import { MyScreen, type WeeklySummary } from './my-screen';

export const dynamic = 'force-dynamic';

// 기능명세서 3.1 원문 — 로그인한 방법에 따른 표시 텍스트 4종
const LOGIN_METHOD_LABEL: Record<string, string> = {
  kakao: '카카오 계정으로 로그인 중',
  google: '구글 계정으로 로그인 중',
  naver: '네이버 계정으로 로그인 중',
  email: '이메일로 로그인 중',
};

/** 이번 주 시작(월요일 00:00, 서버 로컬 시간) — "이번 주 활동 요약" 집계 구간 */
function weekStart(now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/** 주간 요약 3종 집계 — 실패 시 null (화면 유지 후 재조회, 3.1 예외 처리) */
async function loadWeeklySummary(
  admin: ReturnType<typeof getSupabaseAdmin>,
  childIds: string[],
): Promise<WeeklySummary | null> {
  if (childIds.length === 0) return { completedCount: 0, chatCount: 0, badgeCount: 0 };
  const since = weekStart(new Date()).toISOString();

  // 완료한 이야기 — 이번 주 완료 세션 수 (T052가 completed_at·status='completed'를 함께 기록)
  const { count: completedCount, error: completedError } = await admin
    .from('story_sessions')
    .select('id', { count: 'exact', head: true })
    .in('child_id', childIds)
    .eq('status', 'completed')
    .gte('completed_at', since);
  if (completedError || completedCount === null) return null;

  // 대화 횟수 — 이번 주 아이 발화 수 (messages.speaker_type='child')
  const { data: sessions, error: sessionsError } = await admin
    .from('story_sessions')
    .select('id')
    .in('child_id', childIds);
  if (sessionsError) return null;
  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  let chatCount = 0;
  if (sessionIds.length > 0) {
    const { count, error: messagesError } = await admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('session_id', sessionIds)
      .eq('speaker_type', 'child')
      .gte('created_at', since);
    if (messagesError || count === null) return null;
    chatCount = count;
  }

  // 획득한 배지 — 완주 배지 1종/완료 규칙(T055 임시)과 합치: 이번 주 완료 수와 동일
  return { completedCount, chatCount, badgeCount: completedCount };
}

export default async function MyPage() {
  const user = await getAuthedUser();
  if (!user) redirect('/login'); // proxy가 1차 차단 — 직접 렌더 경로 이중 방어

  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('children')
    .select('id, name, birth_date, avatar_key')
    .eq('parent_id', user.id)
    .order('created_at', { ascending: true })
    .limit(3); // 최대 3명 (기능명세서 2.1·3.2 공통)
  if (error) throw new Error(`정보를 불러오지 못했습니다: ${error.message}`); // error.tsx 재시도

  const profiles: ChildProfile[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    birthDate: (row.birth_date as string | null) ?? null,
    avatarKey: (row.avatar_key as string | null) ?? null,
  }));

  const summary = await loadWeeklySummary(admin, profiles.map((p) => p.id));
  const provider = (user.app_metadata?.provider as string | undefined) ?? 'email';

  return (
    <MyScreen
      loginMethodLabel={LOGIN_METHOD_LABEL[provider] ?? LOGIN_METHOD_LABEL.email}
      profiles={profiles}
      summary={summary}
    />
  );
}
