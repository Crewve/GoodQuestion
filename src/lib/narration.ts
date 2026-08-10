// 내레이션 문장 분리·문장별 오디오 키 (T036/T021 공용) — 기능명세서 2.4.1·2.4.2: 온점(.) 기준 분리,
// 문장 단위 자동 재생. 사전 생성 스크립트(pregenerate-audio)와 화면(narration-scene)이 같은 분리 함수를
// 쓰므로 문장 인덱스 ↔ mp3 파일이 항상 1:1이다. 순수 함수 — 클라이언트/서버/CLI 공용.

/** scene_description → 문장 배열 (온점 분리, 각 문장은 온점 포함 표기) */
export function splitNarrationSentences(description: string): string[] {
  return description
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `${s}.`);
}

/** 문장별 고정 오디오 키 — `{scene}__narration_s{1-based}` (R-06 키 규칙의 파생) */
export function narrationSentenceKey(sceneExternalId: string, sentenceIndex: number): string {
  return `${sceneExternalId}__narration_s${sentenceIndex + 1}`;
}

/**
 * 장면 전체 내레이션 URL(/api/sessions의 openingAudioUrl) → 문장별 URL 파생.
 * 페이로드에 external_id가 없어 URL 문자열에서 파생한다 — R-06 파일명 규칙(`{key}.mp3`)에 의존.
 */
export function narrationSentenceAudioUrl(narrationAudioUrl: string, sentenceIndex: number): string {
  return narrationAudioUrl.replace(/\.mp3$/, `_s${sentenceIndex + 1}.mp3`);
}
