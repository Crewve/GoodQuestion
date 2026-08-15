// 2.4.5 핵심 단어 포함 판정 (QA 12 / 피그마 코멘트 #84 — 장면당 핵심 단어 2~4개 확장 검증)
// STT 전사 텍스트에 키워드가 "발화된 형태"로 들어 있는지 확인한다. 순수 부분 문자열 매칭은
// 명사형 키워드의 활용형(미안함→미안해요, 부끄러움→부끄러웠어요, 놀람→깜짝 놀랐어요)을 놓치므로
// 한국어 명사형 어미(-함/-움/-람)에 한해 파생 변형을 함께 검사한다. 형태소 분석기 수준의 정확도가
// 목표가 아니라, 아이가 단어를 말했는데 칩이 켜지지 않는 미인식(false negative)을 줄이는 것이 목적.

const HANGUL_BASE = 0xac00;
const JONG_COUNT = 28;
/** 종성 ㅂ 인덱스 — '러'(받침 없음) → '럽' 파생용 (ㅂ 불규칙: 부끄러움/부끄럽다) */
const JONG_BIEUP = 17;

/** 받침 없는 한글 음절에 종성 ㅂ을 붙인다 — 아니면 null */
function withBieup(syllable: string): string | null {
  const code = syllable.charCodeAt(0);
  if (code < HANGUL_BASE || code > 0xd7a3) return null;
  if ((code - HANGUL_BASE) % JONG_COUNT !== 0) return null; // 이미 받침 있음
  return String.fromCharCode(code + JONG_BIEUP);
}

/** 키워드 하나의 매칭 후보들 — 원형 + 명사형 어미 파생형 */
export function keywordVariants(keyword: string): string[] {
  const variants = new Set<string>([keyword]);
  const base = keyword.slice(0, -1);
  if (base.length >= 1) {
    if (keyword.endsWith('함')) {
      // 미안함 → 미안·미안하·미안했 (미안해요/미안하다고/미안했어요)
      variants.add(base);
      variants.add(`${base}하`);
      variants.add(`${base}했`);
    } else if (keyword.endsWith('움') && base.length >= 2) {
      // 부끄러움 → 부끄러(부끄러워요)·부끄럽(부끄럽다) — ㅂ 불규칙 복원
      variants.add(base);
      const bieup = withBieup(base.slice(-1));
      if (bieup) variants.add(base.slice(0, -1) + bieup);
    } else if (keyword.endsWith('람') && base.length >= 1) {
      // 놀람 → 놀라(놀라서)·놀랐(놀랐어요)
      variants.add(`${base}라`);
      variants.add(`${base}랐`);
    }
  }
  return [...variants];
}

/** 발화 텍스트에 키워드(또는 활용형)가 포함됐는지 — 띄어쓰기 차이는 무시 */
export function keywordIncluded(text: string, keyword: string): boolean {
  if (!text || !keyword) return false;
  const compact = text.replace(/\s+/g, '');
  return keywordVariants(keyword).some((variant) => compact.includes(variant.replace(/\s+/g, '')));
}
