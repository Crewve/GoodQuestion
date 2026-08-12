// T052 — POST /api/post-activity: 학습완료 활동 (contracts/api-routes.md)
// card-order: 서버 정답 판정(프런트 판정 금지, FR-016)·post_activity_results 세션당 1행 upsert·attempt_count +1
// retelling: retelling_text·completed_at 저장 + 세션 완료 처리(status='completed' — 이어하기 제외)
// session_id에 unique 제약이 없어(스키마 확인 2026-08-12) onConflict upsert 대신 select 후 update/insert.
import { judgeCardOrder, parsePostActivityConfig, parsePostActivityRequest } from '@/lib/post-activity';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthedUser } from '@/lib/supabase-server';

function errorJson(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) return errorJson(401, 'UNAUTHENTICATED', '로그인이 필요합니다.');

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson(400, 'BAD_REQUEST', '요청 본문이 JSON이 아닙니다.');
  }
  const parsed = parsePostActivityRequest(body);
  if (!parsed.ok) return errorJson(400, 'BAD_REQUEST', parsed.message);
  const req = parsed.value;

  const admin = getSupabaseAdmin();

  // 세션 조회 + 소유권 확인 (세션의 아이가 로그인한 보호자 소속인지)
  const { data: session } = await admin
    .from('story_sessions')
    .select('id, child_id, story_id, status')
    .eq('id', req.sessionId)
    .maybeSingle();
  if (!session) return errorJson(400, 'BAD_REQUEST', '세션을 찾을 수 없습니다.');
  const { data: child } = await admin
    .from('children')
    .select('id, parent_id')
    .eq('id', session.child_id)
    .maybeSingle();
  if (!child || child.parent_id !== user.id) {
    return errorJson(400, 'BAD_REQUEST', '해당 보호자의 세션이 아닙니다.');
  }

  const { data: existing } = await admin
    .from('post_activity_results')
    .select('id, attempt_count, is_order_correct')
    .eq('session_id', session.id)
    .maybeSingle();

  if (req.kind === 'card-order') {
    const { data: story } = await admin
      .from('stories')
      .select('post_activity_config')
      .eq('id', session.story_id)
      .maybeSingle();
    const config = parsePostActivityConfig(story?.post_activity_config);
    if (!config) {
      return errorJson(400, 'NO_POST_ACTIVITY', '이 이야기의 학습완료 활동 콘텐츠가 없습니다 (시드 여부 확인).');
    }

    const isOrderCorrect = judgeCardOrder(config, req.submittedOrder);
    const attemptCount = (existing?.attempt_count ?? 0) + 1;
    const row = {
      session_id: session.id,
      submitted_order: req.submittedOrder,
      is_order_correct: isOrderCorrect,
      attempt_count: attemptCount,
    };
    const { error: writeError } = existing
      ? await admin.from('post_activity_results').update(row).eq('id', existing.id)
      : await admin.from('post_activity_results').insert({ id: crypto.randomUUID(), ...row });
    if (writeError) return errorJson(502, 'DB_ERROR', `카드 결과 저장 실패: ${writeError.message}`);

    return Response.json({ isOrderCorrect, attemptCount });
  }

  // retelling — 2.4.5는 is_order_correct=true여야 진입 가능(재진입 라우팅 계약)이므로 서버도 강제
  if (!existing || existing.is_order_correct !== true) {
    return errorJson(400, 'ORDER_NOT_CORRECT', '카드 순서 정답 후에만 재구성 발화를 저장할 수 있습니다.');
  }
  const now = new Date().toISOString();
  const { error: retellingError } = await admin
    .from('post_activity_results')
    .update({ retelling_text: req.retellingText, completed_at: now })
    .eq('id', existing.id);
  if (retellingError) return errorJson(502, 'DB_ERROR', `재구성 발화 저장 실패: ${retellingError.message}`);

  // 세션 완료 처리 — status='completed'는 /api/sessions 재개 조회(.neq status completed)에서 제외 = 이어하기 제외
  const { error: sessionError } = await admin
    .from('story_sessions')
    .update({ status: 'completed', completed_at: now, last_activity_at: now })
    .eq('id', session.id);
  if (sessionError) return errorJson(502, 'DB_ERROR', `세션 완료 처리 실패: ${sessionError.message}`);

  return Response.json({ completed: true });
}
