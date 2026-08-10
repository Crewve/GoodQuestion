// 고정 대사 오디오 URL 헬퍼 — `fixed-audio` 공개 버킷, 파일명 `{key}.mp3` (R-06 잠정 합의)
// key는 fixtures/tts-lines.banggui.json의 key와 1:1 (`sc_banggui_03__opening`, `system__stt_retry` 등).
// 실제 mp3 업로드는 파트1 T021(pregenerate-audio) — 업로드 전에는 URL이 404일 수 있다(CLOSING 데모 전 필수).

export function fixedAudioUrl(key: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/fixed-audio/${key}.mp3`;
}
