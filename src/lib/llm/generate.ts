// 캐릭터 생성 LLM (T027, FR-011) — 페르소나 반영 응답 1건 생성.
// GUIDED 시 서버가 지정한 부족 요소(guidanceTarget 1개, 최대 2개)만 유도한다 — 그 외 요소 언급 금지.
// CLOSING은 이 모듈을 호출하지 않는다 (R-04 — 고정 character_closing 재생).
// 후검증(validateReply) 실패 시 throw하지 않고 사유를 반환 — 재시도(1회)는 호출부(/api/turn) 책임.
import charactersFixture from '../../../fixtures/characters.banggui.json';
import { models } from '../config';
import type { ThinkingElement } from '../contracts';
import { getOpenAI } from '../openai';

export type CharacterPersona = {
  external_id: string;
  name: string;
  display_name: string;
  tagline: string;
  traits: { trait: string; detail: string }[];
};

/** fixtures 캐릭터 로드 — 콘텐츠 하드코딩 금지(FR-018), 페르소나는 fixtures가 SoT */
export function loadCharacter(externalId: string): CharacterPersona {
  const character = charactersFixture.characters.find((c) => c.external_id === externalId);
  if (!character) {
    throw new Error(`characters.banggui.json에 없는 캐릭터: ${externalId}`);
  }
  return character;
}

export type GenerateContext = {
  character: CharacterPersona;
  sceneGoal: string;
  mode: 'NORMAL' | 'GUIDED';
  /** GUIDED 시 유도할 부족 요소 — 서버(규칙 엔진)가 지정, 최대 1~2개 */
  guidanceTarget?: ThinkingElement;
  missingElements: ThinkingElement[];
  /** 이번 장면의 대화 내역 (오래된 것부터) */
  history: { speaker: 'child' | 'character'; text: string }[];
  /** 아이 이름 (호칭용 — 없으면 '친구야', R-07과 동일 원칙) */
  childName?: string;
};

// 요소별 유도 화법 가이드 — 규칙 엔진이 고른 요소를 자연스러운 질문으로 옮기는 사전
const GUIDANCE_HINTS: Record<ThinkingElement, string> = {
  DECISION: '어떻게 할지 선택을 물어본다',
  EMOTION: '기분이나 감정이 어떤지 물어본다',
  REASON: '왜 그렇게 생각하는지 이유를 물어본다',
  PERSPECTIVE: '인물의 입장이라면 어떨지 물어본다',
  EMPATHY: '인물의 마음을 헤아려 보게 한다',
  SOLUTION: '어떻게 하면 좋을지 방법을 물어본다',
  RESULT: '그러면 어떤 일이 생길지 물어본다',
  REQUEST: '누구에게 어떻게 부탁하면 좋을지 물어본다',
};

export function buildGenerateMessages(context: GenerateContext) {
  const { character } = context;
  const traits = character.traits.map((t) => `- ${t.trait}: ${t.detail}`).join('\n');
  const childCall = context.childName ? `${context.childName}` : '친구야';

  let guidance = '';
  if (context.mode === 'GUIDED' && context.guidanceTarget) {
    const targets = [context.guidanceTarget];
    guidance = `\n[유도 지시 — 이번 응답에서만]\n아이가 아직 말하지 못한 요소를 딱 ${targets.length}개만 자연스럽게 유도한다: ${targets
      .map((t) => `${t}(${GUIDANCE_HINTS[t]})`)
      .join(', ')}\n다른 요소를 한꺼번에 묻지 않는다. 정답을 대신 말해 주지 않는다. 유도하더라도 아이의 직전 발화를 먼저 이어받은 다음 질문으로 연결한다.`;
  }

  const system = `너는 동화 「방귀 뀌는 며느리」의 캐릭터 '${character.display_name}'(${character.name})이다. 6~9세 아이와 음성으로 대화한다.

[페르소나] ${character.tagline}
${traits}

[장면 목표 — 아이가 이 대화로 이루어야 하는 것. 네가 대신 이루는 것이 아니다]
${context.sceneGoal}

[역할 유지 — 반드시 지킨다]
- 어떤 경우에도 '${character.display_name}'의 입장·감정·말투를 벗어나지 않는다. 장면이 시작될 때의 네 감정(오프닝 대사의 감정)은 아이가 너를 설득하기 전까지 그대로다
- 아이가 너와 다른 생각을 말하거나 다른 인물의 편을 들어도, 역할을 바꿔 다른 인물을 대변하지 않는다
- 다른 인물의 사정·마음을 네가 설명하거나 두둔하지 않는다 — 그 생각은 질문으로만 꺼낸다 (예: "그 사람 마음은 어땠을까?")
- 아이와 생각이 달라도 지적하지 않고, 네 입장을 지킨 채 아이의 생각을 더 물어본다
- 목표에 담긴 결론·이유·해답은 아이의 입에서 나와야 한다 — 네가 먼저 말하지 않는다

[아동 안전 규칙 — 반드시 지킨다]
- 아이의 말을 평가하거나 지적하지 않는다 (틀렸다·아니다·부족하다 금지)
- 무섭거나 폭력적이거나 아이를 놀리는 표현 금지
- 쉬운 말, 캐릭터 말투 유지, 아이를 '${childCall}'라고 부를 수 있다

[응답 형식]
- 1~2문장, 짧게 말한다 (음성으로 재생된다)
- 먼저 아이의 말에 짧게 반응한 뒤, 대화를 이어가는 질문 1개로 끝낸다
- 화제를 옮길 때는 아이가 방금 한 말의 단어나 생각을 받아서 이어간다 — 갑자기 새 화제로 점프하지 않는다${guidance}`;

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: system },
  ];
  for (const turn of context.history) {
    messages.push({
      role: turn.speaker === 'character' ? 'assistant' : 'user',
      content: turn.text,
    });
  }
  return messages;
}

export type ReplyValidation = { ok: true } | { ok: false; reason: 'EMPTY' | 'TOO_LONG' | 'BANNED_WORD' };

// 금칙어 — 아동 대상 부적절 표현 최소 목록 (부분 문자열 매칭, 필요 시 추가)
const BANNED_WORDS = ['죽어', '죽여', '때리', '바보', '멍청', '꺼져', '미친', '싫어 죽'];

/** 후검증 (FR-011) — 길이·금칙어. 한도 160자: 2문장 + TTS 지연·월 3만 자 한도 보호 */
export function validateReply(text: string, maxChars = 160): ReplyValidation {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: 'EMPTY' };
  if (trimmed.length > maxChars) return { ok: false, reason: 'TOO_LONG' };
  if (BANNED_WORDS.some((word) => trimmed.includes(word))) {
    return { ok: false, reason: 'BANNED_WORD' };
  }
  return { ok: true };
}

/**
 * 캐릭터 응답 1건 생성 + 후검증. 검증 실패 시 throw — 폴백 매트릭스에 따라
 * 호출부가 1회 재시도 후 실패하면 502 또는 고정 대사 폴백.
 */
export async function generateReply(context: GenerateContext): Promise<string> {
  const completion = await getOpenAI().chat.completions.create({
    model: models.generation,
    messages: buildGenerateMessages(context),
    temperature: 0.7,
    max_tokens: 200,
  });
  const reply = completion.choices[0]?.message?.content?.trim() ?? '';
  const validation = validateReply(reply);
  if (!validation.ok) {
    throw new Error(`캐릭터 응답 후검증 실패(${validation.reason}): ${reply.slice(0, 80)}`);
  }
  return reply;
}
