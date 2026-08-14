// POST /api/stt (T030) — api/ 중 유일한 파트1 소유 파일 (contracts/api-routes.md).
// multipart(audio·sceneId·context) → 장면 힌트 → Whisper → 게이트 → 교정 → SttResult 200.
// 이 라우트는 아무것도 저장하지 않는다: 오디오는 메모리→OpenAI 스트리밍 후 GC, 디스크·DB 기록 없음.
// 저장은 아이가 '보내기'를 눌러 /api/turn을 호출할 때만 일어난다.
// 인증은 Supabase 세션 미들웨어(T010, 파트2) 계층 담당 — 여기서 중복 검사하지 않는다.
import { toFile } from 'openai';
import { speechToText, buildSttHint } from '@/lib/stt';
import { devSttFallbackText } from '@/lib/stt/dev-fallback';
import type { SttResult } from '@/lib/contracts';

const CONTEXTS = new Set(['dialogue', 'mission', 'retelling']);
// 녹음 상한 30초(T034)의 webm/mp4는 수 MB 수준 — 초과분은 입력 오류로 차단
const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

/** MediaRecorder mime → Whisper 형식 추정용 확장자 (formData File 이름이 'blob'인 경우 대비) */
const MIME_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/ogg': 'ogg',
};

function badRequest(message: string): Response {
  return Response.json({ error: { code: 'BAD_REQUEST', message } }, { status: 400 });
}

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return badRequest('multipart/form-data 본문이 필요합니다.');
  }

  const audio = form.get('audio');
  if (!(audio instanceof File) || audio.size === 0) return badRequest('audio 파일이 필요합니다.');
  if (audio.size > MAX_AUDIO_BYTES) return badRequest('오디오가 너무 큽니다 (30초 이하 녹음만 허용).');

  const context = form.get('context');
  if (typeof context !== 'string' || !CONTEXTS.has(context)) {
    return badRequest('context는 dialogue|mission|retelling 중 하나여야 합니다.');
  }

  const sceneIdRaw = form.get('sceneId');
  const sceneId = typeof sceneIdRaw === 'string' && sceneIdRaw.trim() ? sceneIdRaw.trim() : undefined;
  // 계약 외 선택 필드 — 직전 캐릭터 대사(GUIDED 추가 질문 등)는 가장 강한 힌트라 있으면 사용
  const replyRaw = form.get('characterReply');
  const characterReply = typeof replyRaw === 'string' && replyRaw.trim() ? replyRaw.trim() : undefined;

  // 장면 external_id(sc_*)는 fixtures에서 직접 해석. uuid는 시드(T008) 매핑 연동 전까지 기본 어휘로 폴백
  const hint = buildSttHint(sceneId?.startsWith('sc_') ? sceneId : undefined, characterReply);

  const mime = (audio.type || 'audio/webm').split(';')[0];
  const file = await toFile(audio, `recording.${MIME_EXT[mime] ?? 'webm'}`, { type: mime });

  try {
    const result = await speechToText(file, { hint });
    let body: SttResult = { text: result.text, sttRawText: result.sttRawText, failed: result.failed };
    // 로컬 개발 전용: 게이트 실패(무의미한 소리 등)면 장면 정석 예시로 대체해 이야기 진행을 확인 가능하게
    // 한다 (dev-fallback.ts — NODE_ENV=development 외에는 null이라 배포 동작 불변)
    if (body.failed) {
      const fallback = devSttFallbackText(context, sceneId);
      if (fallback) body = { text: fallback, sttRawText: result.sttRawText || fallback, failed: false };
    }
    return Response.json(body);
  } catch (error) {
    // 폴백 매트릭스: Whisper 실패/타임아웃 → failed:true 200 — 클라이언트는 재녹음 유도, 메시지 미생성
    console.error('[api/stt] Whisper 호출 실패:', error);
    const fallback = devSttFallbackText(context, sceneId);
    const body: SttResult = fallback
      ? { text: fallback, sttRawText: fallback, failed: false }
      : { text: '', sttRawText: '', failed: true };
    return Response.json(body);
  }
}
