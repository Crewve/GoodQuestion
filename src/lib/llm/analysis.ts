// 분석 LLM (T025, FR-009, R-03) — 아이 발화 1건 → 4필드 구조화 출력(RawAnalysis).
// 탐지는 항상 8요소 전체를 대상으로 한다. requiredElements는 인정 기준·참고 입력일 뿐
// 탐지 범위를 제한하지 않는다. 원본(raw)은 호출부가 로그로 보존하고, 확정은 postprocess가 한다.
import { models } from '../config';
import type { ThinkingElement } from '../contracts';
import { getOpenAI } from '../openai';
import type { RawAnalysis } from './postprocess';

/** utterance_analyses.analysis_version 태깅 값 — 프롬프트/스키마 변경 시 올린다 */
export const ANALYSIS_VERSION = 'mvp_v2'; // v2: 요소 구분 예시·복합 문장 절 단위 탐지·SHORT 기준 명확화 (eval 1차 회귀 반영)

export type AnalysisContext = {
  sceneGoal: string;
  characterName: string;
  /** 직전 캐릭터 발화 — 아이 답변의 맥락 */
  characterQuestion: string;
  /** 장면 목표 요소 — 참고 입력 (탐지 범위 제한 금지) */
  requiredElements: ThinkingElement[];
};

// 8요소 정의 — Notion DB 구조 §5 허용값. 설명은 분석 일관성을 위한 프롬프트 자산(콘텐츠 아님).
const ELEMENT_GUIDE = `
- DECISION(결정): 무엇을 할지/하지 않을지 선택을 말함 (예: "나라면 말할 거야")
- EMOTION(감정): 자신 또는 인물의 감정·기분을 말하거나 추측함 (예: "슬펐을 것 같아요", "저도 기뻐요")
- REASON(이유): 왜 그런지 이유·근거를 말함 — '~니까', '~아서/어서', '~때문에', '~잖아요' 절이 단서
- PERSPECTIVE(관점): 인물의 입장·처지가 되어 생각함 (예: "내가 며느리라면", "할아버지 입장도 생각해 주세요")
- EMPATHY(공감): 인물의 마음을 헤아려 위로·공감을 표현함 (예: "괜찮아요", "이해해요", "얼마나 힘들었겠어요")
- SOLUTION(해결): 문제를 해결할 방법·아이디어를 제안함 (예: "~하면 돼요", "~해 보면 어때요")
- RESULT(결과): 어떤 일의 결과·앞으로 생길 일을 말함 (예: "~될 거예요", "~다칠 수 있어요")
- REQUEST(요청): 누군가에게 부탁·요청함 (예: "~해 주세요", "~해 달라고 부탁해요")`.trim();

// child_intent 예시 목록 — Notion DB 구조 §8 (예시이므로 스키마 강제는 하지 않음)
const INTENT_EXAMPLES =
  'QUESTION, OPINION, REASONING, SOLUTION, DECISION, PERSPECTIVE, EMOTION, REQUEST, CHALLENGE, PLAYFUL, OFF_TOPIC, SHORT_RESPONSE, UNCLEAR';

export function buildAnalysisMessages(utterance: string, context: AnalysisContext) {
  const system = `너는 아동 발화 분석기다. 동화 속 캐릭터와 대화하는 아이(6~9세)의 발화 1건을 분석해 JSON으로만 답한다.

[사고 요소 — 반드시 아래 8개 전체를 탐지 대상으로 삼는다. 장면 목표 요소만 찾지 말 것]
${ELEMENT_GUIDE}

[규칙]
- detected_elements: 발화에 실제로 나타난 요소만 담는다. 각 evidence는 반드시 아이 발화 원문에서 그대로 인용한 부분 문자열이어야 한다 (바꿔 쓰기 금지).
- **한 발화에 여러 요소가 함께 있으면 각각 모두 태그한다. 절 단위로 살핀다.**
  예: "방귀가 세니까 배가 떨어질 거예요" → REASON("방귀가 세니까") + RESULT("배가 떨어질 거예요")
  예: "멀리 피해야 해요 다치면 안 되니까요" → SOLUTION + REASON
- 인물의 감정을 추측·언급하면(예: "슬펐을 것 같아요") EMOTION이다. 위로·공감의 태도가 함께 있으면 EMPATHY도 같이 태그한다 — EMPATHY 하나로 합치지 않는다.
- **REASON은 가장 놓치기 쉽다**: '~니까', '~아서/어서', '~때문에', '~잖아요' 절이 보이면 반드시 REASON 태그 여부를 검토한다. SOLUTION·RESULT와 겹쳐도 REASON을 빠뜨리지 않는다.
  예: "배가 아파서 병이 날 수도 있어요" → REASON("배가 아파서") + RESULT("병이 날 수도 있어요")
- 같은 요소는 한 번만 담는다. 근거 절이 없는 요소는 넣지 않는다.
- child_intent: 발화의 의도 분류 1개 (예: ${INTENT_EXAMPLES})
- main_point: 아이 발화의 핵심 요지를 한 문장으로 요약
- utterance_validity 기준: VALID(의미가 파악되는 유효 발화) / SHORT(한두 단어짜리 짧은 대답 — "몰라요", "네", "그냥요") / UNCLEAR(뜻을 알기 어려움) / OFF_TOPIC(장면과 관련 없음) / PLAYFUL(장난·소리 흉내 등)`;

  const user = `[장면 목표] ${context.sceneGoal}
[장면 목표 요소(참고 — 탐지 범위를 제한하지 않음)] ${context.requiredElements.join(', ')}
[캐릭터(${context.characterName})의 직전 말] ${context.characterQuestion}
[아이 발화] ${utterance}`;

  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];
}

/** 구조화 출력 JSON 스키마 (strict) — 4필드 required, snake_case(연동기준 §1-6: 경계에서 camelCase 변환) */
export const ANALYSIS_JSON_SCHEMA = {
  name: 'utterance_analysis',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['child_intent', 'main_point', 'detected_elements', 'utterance_validity'],
    properties: {
      child_intent: { type: 'string' },
      main_point: { type: 'string' },
      detected_elements: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'evidence'],
          properties: {
            type: {
              type: 'string',
              enum: ['DECISION', 'EMOTION', 'REASON', 'PERSPECTIVE', 'EMPATHY', 'SOLUTION', 'RESULT', 'REQUEST'],
            },
            evidence: { type: 'string' },
          },
        },
      },
      utterance_validity: {
        type: 'string',
        enum: ['VALID', 'SHORT', 'UNCLEAR', 'OFF_TOPIC', 'PLAYFUL'],
      },
    },
  },
} as const;

/** LLM 응답 텍스트 → RawAnalysis. 4필드 검증 실패 시 throw — 호출부가 1회 재시도(폴백 매트릭스) */
export function parseRawAnalysis(text: string): RawAnalysis {
  const json = JSON.parse(text);
  const validities = ['VALID', 'SHORT', 'UNCLEAR', 'OFF_TOPIC', 'PLAYFUL'];
  if (
    typeof json.child_intent !== 'string' ||
    typeof json.main_point !== 'string' ||
    !Array.isArray(json.detected_elements) ||
    !validities.includes(json.utterance_validity)
  ) {
    throw new Error(`분석 응답이 4필드 계약을 위반했습니다: ${text.slice(0, 200)}`);
  }
  return {
    childIntent: json.child_intent,
    mainPoint: json.main_point,
    detectedElements: json.detected_elements.map((element: { type: string; evidence: string }) => ({
      type: element.type,
      evidence: String(element.evidence ?? ''),
    })),
    utteranceValidity: json.utterance_validity,
  };
}

/** 아이 발화 1건을 분석한다. 반환은 LLM 원본(raw) — 확정은 postprocessAnalysis 몫 */
export async function analyzeUtterance(
  utterance: string,
  context: AnalysisContext,
): Promise<RawAnalysis> {
  const completion = await getOpenAI().chat.completions.create({
    model: models.analysis,
    messages: buildAnalysisMessages(utterance, context),
    response_format: { type: 'json_schema', json_schema: ANALYSIS_JSON_SCHEMA },
    temperature: 0.2, // 분석은 재현성 우선
  });
  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error('분석 LLM 응답이 비어 있습니다.');
  return parseRawAnalysis(content);
}
