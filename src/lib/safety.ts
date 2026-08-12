// 입력측 부적절 발화 스크리닝 (T075, E2E 항목 24) — 순수 코드 판정, LLM·DB 무관.
// 아이 발화를 차단하거나 저장에서 빼지 않는다(리포트가 발화 원문을 쓰므로). 판정 결과는
// /api/turn이 생성 프롬프트의 '주제 복귀' 지시(redirect)로만 소비한다 — 평가·지적 없이 부드럽게 복귀.
// 출력측 금칙어(generate.ts BANNED_WORDS — 캐릭터 응답 후검증)와 목적이 달라 목록을 분리 유지한다.

// 부분 문자열 매칭 — 오탐(예: 드물게 '죽어가는 나무')의 대가는 부드러운 주제 복귀뿐이라 수용
const INAPPROPRIATE_WORDS = [
  '씨발',
  '시발',
  'ㅅㅂ',
  '병신',
  'ㅂㅅ',
  '존나',
  '졸라',
  '개새',
  '새끼',
  '미친',
  '닥쳐',
  '꺼져',
  '죽어',
  '죽여',
  '때려',
  '바보',
  '멍청',
  '등신',
  '찐따',
  '또라이',
  '엿먹',
  '지랄',
];

/** 비속어·욕설 포함 여부 — true면 캐릭터가 내용을 따라 말하지 않고 주제로 되돌린다 */
export function containsInappropriateLanguage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return INAPPROPRIATE_WORDS.some((word) => trimmed.includes(word));
}
