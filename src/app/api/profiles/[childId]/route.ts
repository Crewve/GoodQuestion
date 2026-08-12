// PATCH·DELETE /api/profiles/[childId] — 아이 프로필 수정·삭제 (T057 확장, 기능명세서 3.2 '프로필 관리').
// 수정: 폼 전체 필드 제출 → 등록(T046)과 동일 검증(parseChildUpdatePayload)·birth_year 파생 갱신.
// 삭제: 스키마에 ON DELETE CASCADE가 없어(FK 확인 2026-08-12) 자식 데이터를 순서대로 직접 삭제한다 —
// utterance_analyses → messages → post_activity_results → reports → story_sessions → wordbook →
// child_consents → children. (reports.session_id·wordbook.child_id는 FK 미설정이지만 함께 정리)
import { parseChildUpdatePayload } from '@/lib/auth/profiles-payload';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';

function errorJson(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

/** 아이가 로그인한 보호자 소속인지 확인 — 아니면 null (응답은 호출부가 결정) */
async function ownedChild(childId: string, userId: string) {
  const { data: child } = await getSupabaseAdmin()
    .from('children')
    .select('id, parent_id')
    .eq('id', childId)
    .maybeSingle();
  return child && child.parent_id === userId ? child : null;
}

export async function PATCH(request: Request, ctx: RouteContext<'/api/profiles/[childId]'>) {
  const user = await getAuthedUser();
  if (!user) return errorJson(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');
  const { childId } = await ctx.params;
  if (!(await ownedChild(childId, user.id))) {
    return errorJson(400, 'BAD_REQUEST', '해당 보호자의 아이가 아닙니다.');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'BAD_REQUEST', '요청 본문이 JSON이 아닙니다.');
  }
  const parsed = parseChildUpdatePayload(body);
  if (!parsed.ok) return errorJson(400, 'BAD_REQUEST', parsed.message);

  const { data: updated, error } = await getSupabaseAdmin()
    .from('children')
    .update({
      name: parsed.child.name,
      avatar_key: parsed.child.avatarKey,
      birth_date: parsed.child.birthDate,
      birth_year: parsed.child.birthYear, // 파생 컬럼 동기 갱신 (Notion 설계서 원형 유지 — 리포트 호환)
    })
    .eq('id', childId)
    .select('id, name, avatar_key, birth_date')
    .single();
  if (error) return errorJson(502, 'DB_ERROR', `프로필 수정 실패: ${error.message}`);

  return Response.json({ child: updated });
}

export async function DELETE(_request: Request, ctx: RouteContext<'/api/profiles/[childId]'>) {
  const user = await getAuthedUser();
  if (!user) return errorJson(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');
  const { childId } = await ctx.params;
  if (!(await ownedChild(childId, user.id))) {
    return errorJson(400, 'BAD_REQUEST', '해당 보호자의 아이가 아닙니다.');
  }

  const admin = getSupabaseAdmin();

  // 학습 기록 캐스케이드 — FK 부모(세션·메시지)보다 자식 테이블을 먼저 비운다
  const { data: sessions, error: sessionsError } = await admin
    .from('story_sessions')
    .select('id')
    .eq('child_id', childId);
  if (sessionsError) return errorJson(502, 'DB_ERROR', `세션 조회 실패: ${sessionsError.message}`);
  const sessionIds = (sessions ?? []).map((s) => s.id);

  if (sessionIds.length > 0) {
    const { data: messages, error: messagesError } = await admin
      .from('messages')
      .select('id')
      .in('session_id', sessionIds);
    if (messagesError) return errorJson(502, 'DB_ERROR', `메시지 조회 실패: ${messagesError.message}`);
    const messageIds = (messages ?? []).map((m) => m.id);

    if (messageIds.length > 0) {
      const { error } = await admin.from('utterance_analyses').delete().in('message_id', messageIds);
      if (error) return errorJson(502, 'DB_ERROR', `발화 분석 삭제 실패: ${error.message}`);
    }
    for (const table of ['messages', 'post_activity_results', 'reports'] as const) {
      const { error } = await admin.from(table).delete().in('session_id', sessionIds);
      if (error) return errorJson(502, 'DB_ERROR', `${table} 삭제 실패: ${error.message}`);
    }
    const { error: sessionDeleteError } = await admin.from('story_sessions').delete().eq('child_id', childId);
    if (sessionDeleteError) return errorJson(502, 'DB_ERROR', `세션 삭제 실패: ${sessionDeleteError.message}`);
  }

  for (const table of ['wordbook', 'child_consents'] as const) {
    const { error } = await admin.from(table).delete().eq('child_id', childId);
    if (error) return errorJson(502, 'DB_ERROR', `${table} 삭제 실패: ${error.message}`);
  }
  const { error: childError } = await admin.from('children').delete().eq('id', childId);
  if (childError) return errorJson(502, 'DB_ERROR', `프로필 삭제 실패: ${childError.message}`);

  return Response.json({ deleted: true });
}
