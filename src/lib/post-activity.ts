// T052 학습완료 활동 판정 로직 — stories.post_activity_config(R-09) 검증·카드 순서 서버 판정·요청 파싱.
// 정답 판정은 반드시 서버에서 수행한다(FR-016 — 프런트 판정 금지). 라우트는 이 모듈만 사용한다.

export type PostActivityCard = { id: string; image_key: string; label: string };

export type PostActivityConfig = {
  cards: PostActivityCard[];
  answer_order: string[];
  /** keywords[i] = answer_order[i] 장면의 핵심 단어 묶음 (2.4.5 카드 아래 칩들, QA 12) */
  keywords: string[][];
};

export type PostActivityRequest =
  | { kind: 'card-order'; sessionId: string; submittedOrder: string[] }
  | { kind: 'retelling'; sessionId: string; retellingText: string };

export type ParsedRequest =
  | { ok: true; value: PostActivityRequest }
  | { ok: false; message: string };

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/**
 * keywords 정규화 — 장면당 단어 묶음(string[][])이 현재 형태.
 * 장면당 1개였던 이전 형태(string[])도 그대로 받아 [단어] 한 묶음으로 감싼다:
 * 코드 배포가 시드 재실행보다 먼저 나가는 순간이 있어(스테이징 자동 배포) 그 사이에도 화면이 죽지 않게 한다.
 */
function normalizeKeywords(value: unknown): string[][] | null {
  if (!Array.isArray(value)) return null;
  if (isStringArray(value)) return value.map((word) => [word]);
  const groups: string[][] = [];
  for (const group of value) {
    if (!isStringArray(group) || group.length === 0) return null;
    groups.push(group);
  }
  return groups;
}

/** DB JSON → 검증된 config. 미저작(null)·형식 불일치는 null — 라우트에서 오류 응답으로 변환. */
export function parsePostActivityConfig(value: unknown): PostActivityConfig | null {
  if (typeof value !== 'object' || value === null) return null;
  const { cards, answer_order, keywords } = value as Record<string, unknown>;
  if (!Array.isArray(cards) || cards.length === 0) return null;
  for (const card of cards) {
    if (typeof card !== 'object' || card === null) return null;
    const { id, image_key, label } = card as Record<string, unknown>;
    if (typeof id !== 'string' || typeof image_key !== 'string' || typeof label !== 'string') return null;
  }
  if (!isStringArray(answer_order)) return null;
  const keywordGroups = normalizeKeywords(keywords);
  if (keywordGroups === null) return null;
  // 카드·정답 순서·키워드 묶음은 장면 단위로 1:1(기능명세서 2.4.5) — 길이가 어긋난 콘텐츠는 저작 오류
  if (answer_order.length !== cards.length || keywordGroups.length !== cards.length) return null;
  const cardIds = new Set((cards as PostActivityCard[]).map((c) => c.id));
  if (!answer_order.every((id) => cardIds.has(id))) return null;
  return { cards: cards as PostActivityCard[], answer_order, keywords: keywordGroups };
}

/** 카드 순서 정답 판정 — answer_order와 위치까지 완전 일치해야 정답. */
export function judgeCardOrder(config: PostActivityConfig, submittedOrder: string[]): boolean {
  return (
    submittedOrder.length === config.answer_order.length &&
    config.answer_order.every((id, i) => submittedOrder[i] === id)
  );
}

/** 요청 본문 → kind별 검증된 요청. 실패 메시지는 400 응답에 그대로 사용. */
export function parsePostActivityRequest(body: unknown): ParsedRequest {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, message: '요청 본문이 올바르지 않습니다.' };
  }
  const { sessionId, kind, submittedOrder, retellingText } = body as Record<string, unknown>;
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return { ok: false, message: 'sessionId는 필수입니다.' };
  }
  if (kind === 'card-order') {
    if (!isStringArray(submittedOrder) || submittedOrder.length === 0) {
      return { ok: false, message: 'submittedOrder는 카드 id 문자열 배열이어야 합니다.' };
    }
    return { ok: true, value: { kind, sessionId, submittedOrder } };
  }
  if (kind === 'retelling') {
    const text = typeof retellingText === 'string' ? retellingText.trim() : '';
    if (text.length === 0) {
      return { ok: false, message: 'retellingText는 공백이 아닌 텍스트여야 합니다.' };
    }
    return { ok: true, value: { kind, sessionId, retellingText: text } };
  }
  return { ok: false, message: "kind는 'card-order' 또는 'retelling'이어야 합니다." };
}
