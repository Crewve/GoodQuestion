// 'ㅇㅇ'(아이 이름) 자리표시자 치환 (R-07 확정 2026-08-11 — 실명 호출)
// 받침 유무로 조사를 맞춘다: 호격 'ㅇㅇ아'→'민준아/지우야', 주격 'ㅇㅇ이'→'민준이/지우'.
// 이름이 없으면 pregenerate-audio(T021)의 '친구' 치환과 동일 규칙 — 고정 오디오 폴백본과 표기 일치.

/** 마지막 글자가 받침 있는 한글 음절인지 — 비한글(영문 이름 등)은 받침 없음으로 간주 */
function hasFinalConsonant(name: string): boolean {
  const code = name.charCodeAt(name.length - 1) - 0xac00;
  return code >= 0 && code < 11172 && code % 28 !== 0;
}

export function substituteChildName(text: string, name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) {
    return text.replaceAll('ㅇㅇ아', '친구야').replaceAll('ㅇㅇ이', '친구').replaceAll('ㅇㅇ', '친구');
  }
  const vocative = hasFinalConsonant(trimmed) ? `${trimmed}아` : `${trimmed}야`;
  const subject = hasFinalConsonant(trimmed) ? `${trimmed}이` : trimmed;
  return text.replaceAll('ㅇㅇ아', vocative).replaceAll('ㅇㅇ이', subject).replaceAll('ㅇㅇ', trimmed);
}
