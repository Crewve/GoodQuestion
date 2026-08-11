// 이메일 가입 여부 프로브 (T044) — 기능명세서 1.1.1 에러 문구 3종 중
// "가입하지 않은 이메일입니다"/"비밀번호를 다시 확인해주세요" 구분에 필요하다.
// Supabase signInWithPassword는 두 경우를 같은 invalid_credentials로 돌려줘(계정 열거 방지)
// 클라이언트만으로는 구분 불가 — 명세가 구분 문구를 요구하므로(SSOT: 기능명세서 우선) 서버에서 판별한다.
// generateLink는 메일 발송 없이 링크만 생성하는 admin API라 부작용 없이 존재 여부만 얻는다.
// (계정 열거를 여는 트레이드오프 — 명세 요구 반영. 정식 서비스 전 레이트리밋 필요, 팀 공유용 주석)
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim();
  if (!email || !/^[^\s@]+@[^\s@]+$/.test(email)) {
    return Response.json({ error: { code: 'BAD_REQUEST', message: '이메일이 필요합니다.' } }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.generateLink({ type: 'recovery', email });
  // user_not_found(404)만 미가입 확정 — 그 외 오류는 존재 취급(일반 문구 쪽으로 폴백)
  const exists = !(error && error.status === 404);
  return Response.json({ exists });
}
