// 서버 후처리 (T026, R-03) — 분석 LLM 원본을 확정본으로 정제한다.
// 계약 불변 조건 2: evidence는 아이 발화 원문의 부분 문자열 — 위반 시 제거·보정.
// LLM 원본(raw)은 여기서 버리지 않는다 — 호출부(/api/turn)가 서버 로그로 보존(R-11-4).
import type { AnalysisResult, ThinkingElement } from '../contracts';

/** 분석 LLM 원본 — type이 8요소 허용값 밖일 수 있어 string으로 받는다 */
export type RawAnalysis = Omit<AnalysisResult, 'detectedElements'> & {
  detectedElements: { type: string; evidence: string }[];
};

export type DropReason = 'INVALID_TYPE' | 'EVIDENCE_NOT_QUOTED' | 'DUPLICATE' | 'WEAK_EVIDENCE';

export type PostprocessResult = {
  /** 확정본 — utterance_analyses 저장·규칙 엔진 입력용 */
  refined: AnalysisResult;
  /** 제거된 탐지와 사유 (서버 로그용) */
  dropped: { type: string; evidence: string; reason: DropReason }[];
  /** evidence를 원문 표기로 보정한 건수 */
  correctedCount: number;
};

const ALLOWED_ELEMENTS: readonly ThinkingElement[] = [
  'DECISION', 'EMOTION', 'REASON', 'PERSPECTIVE',
  'EMPATHY', 'SOLUTION', 'RESULT', 'REQUEST',
];

/** 공백 무시 매칭으로 원문 인용 구간을 찾는다. 정확 일치 → 그대로, 공백 차이 → 원문 표기, 불일치 → null */
function findQuote(utterance: string, evidence: string): string | null {
  const trimmed = evidence.trim();
  if (!trimmed) return null;
  if (utterance.includes(trimmed)) return trimmed;

  const target = trimmed.replace(/\s+/g, '');
  if (!target) return null;
  // 원문 인덱스를 보존한 채 공백 제거 후 탐색 — 매치 구간을 원문 그대로 잘라 보정한다
  const chars: { ch: string; idx: number }[] = [];
  for (let i = 0; i < utterance.length; i += 1) {
    if (!/\s/.test(utterance[i])) chars.push({ ch: utterance[i], idx: i });
  }
  const flat = chars.map((c) => c.ch).join('');
  const pos = flat.indexOf(target);
  if (pos === -1) return null;
  return utterance.slice(chars[pos].idx, chars[pos + target.length - 1].idx + 1);
}

export function postprocessAnalysis(utterance: string, rawAnalysis: RawAnalysis): PostprocessResult {
  const dropped: PostprocessResult['dropped'] = [];
  const refined: AnalysisResult['detectedElements'] = [];
  let correctedCount = 0;
  const seen = new Set<ThinkingElement>();

  for (const detection of rawAnalysis.detectedElements) {
    const type = detection.type as ThinkingElement;
    if (!ALLOWED_ELEMENTS.includes(type)) {
      dropped.push({ ...detection, reason: 'INVALID_TYPE' });
      continue;
    }
    if (seen.has(type)) {
      dropped.push({ ...detection, reason: 'DUPLICATE' });
      continue;
    }
    if (detection.evidence.replace(/\s+/g, '').length <= 1) {
      dropped.push({ ...detection, reason: 'WEAK_EVIDENCE' });
      continue;
    }
    const quote = findQuote(utterance, detection.evidence);
    if (quote === null) {
      dropped.push({ ...detection, reason: 'EVIDENCE_NOT_QUOTED' });
      continue;
    }
    if (quote !== detection.evidence) correctedCount += 1;
    seen.add(type);
    refined.push({ type, evidence: quote });
  }

  return {
    refined: {
      childIntent: rawAnalysis.childIntent,
      mainPoint: rawAnalysis.mainPoint,
      detectedElements: refined,
      utteranceValidity: rawAnalysis.utteranceValidity,
    },
    dropped,
    correctedCount,
  };
}
