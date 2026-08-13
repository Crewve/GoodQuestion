// 캐릭터 생성 LLM (T027, FR-011) — 페르소나 반영 응답 1건 생성.
// GUIDED 시 서버가 지정한 부족 요소(guidanceTarget 1개, 최대 2개)만 유도한다 — 그 외 요소 언급 금지.
// CLOSING은 이 모듈을 호출하지 않는다 (R-04 — 고정 character_closing 재생).
// 후검증(validateReply) 실패 시 throw하지 않고 사유를 반환 — 재시도(1회)는 호출부(/api/turn) 책임.
import charactersFixture from '../../../fixtures/characters.banggui.json';
import { substituteChildName } from '../child-name';
import { models } from '../config';
import type { ThinkingElement } from '../contracts';
import { getOpenAI } from '../openai';
import { givenName } from '../profile-display';

/** 은/는 조사 — child-name.ts hasFinalConsonant와 동일 규칙 (비공개 export라 로컬 유지, 수정 시 동기화) */
function topicParticle(word: string): '은' | '는' {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code < 11172 && code % 28 !== 0 ? '은' : '는';
}

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
  /**
   * 입력측 부적절·주제 이탈 발화 처리 (T075, E2E 항목 24) — 서버가 safety.ts 스크리닝·분석
   * validity로 판정해 지정. 캐릭터는 내용을 따라 말하지 않고 나무람 없이 주제로 되돌린다.
   */
  redirect?: 'INAPPROPRIATE' | 'OFF_TOPIC';
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
  // 성 제외 이름으로 호칭 — "정진욱, 맞아!" 같은 성 포함 호명은 부자연 (홈 인사말 givenName 규칙과 동일)
  const childCall = context.childName ? givenName(context.childName) : '친구야';
  // 호격은 받침 규칙으로 확정 렌더 — 슬래시 표기('아/야') 오선택·TTS 유출 방지, 고정 오디오 오프닝과 표기 일치
  const childVocative = substituteChildName('ㅇㅇ아', context.childName ? childCall : null);
  // 주어 예시 인물은 fixtures에서 화자 아닌 인물로 파생(FR-018) — 자기 자신이 예시면 모델이
  // 그대로 복사해 3인칭 자기 지칭이 된다(simulate 회귀에서 확인). 문장은 스포일러 없는 중립 템플릿.
  const subjectName =
    charactersFixture.characters.find((c) => c.external_id !== character.external_id)?.name ?? '그 인물';
  const subjectExample = `${subjectName}${topicParticle(subjectName)} 왜 그랬을까?`;

  let guidance = '';
  if (context.mode === 'GUIDED' && context.guidanceTarget) {
    const targets = [context.guidanceTarget];
    guidance = `\n[유도 지시 — 이번 응답에서만]\n아이가 아직 말하지 못한 요소를 딱 ${targets.length}개만 자연스럽게 유도한다: ${targets
      .map((t) => `${t}(${GUIDANCE_HINTS[t]})`)
      .join(', ')}\n다른 요소를 한꺼번에 묻지 않는다. 정답을 대신 말해 주지 않는다. 유도하더라도 아이의 직전 발화를 먼저 이어받은 다음 질문으로 연결한다.`;
  }

  let redirect = '';
  if (context.redirect) {
    const cause =
      context.redirect === 'INAPPROPRIATE'
        ? '이야기와 어울리지 않는 표현이 섞여 있다'
        : '지금 이야기와 관련이 없다';
    redirect = `\n[주제 복귀 — 이번 응답에서만]\n아이의 마지막 말은 ${cause}. 그 내용이나 표현을 따라 말하지 않고, 궁금해하거나 칭찬하지도 않는다. 나무라지 말고 아주 짧게 받아넘긴 뒤, 지금 이야기 주제로 부드럽게 다시 초대하는 질문 1개로 끝낸다. 이 지시는 [응답 형식]의 '핵심 단어 받기'·'첫마디 열기' 규칙보다 우선한다 — 부적절하거나 관련 없는 표현은 핵심 단어로도 되받지 않는다.`;
  }

  const system = `너는 동화 「방귀 뀌는 며느리」의 캐릭터 '${character.display_name}'(${character.name})이다. 6~9세 아이와 음성으로 대화한다.

[페르소나] ${character.tagline}
${traits}

[장면 목표 — 아이가 이 대화로 이루어야 하는 것. 네가 대신 이루는 것이 아니다]
${context.sceneGoal}

[역할 유지 — 반드시 지킨다]
- 너는 '${character.display_name}' 본인이다 — 자신의 이름을 남 이야기하듯 3인칭으로 쓰지 않는다. 네 이야기는 '나'로 말하고, 네 마음을 아이에게 물을 때도 "내가 어떤 기분이었을 것 같아?"처럼 '나'로 묻는다
- 어떤 경우에도 '${character.display_name}'의 입장·감정·말투를 벗어나지 않는다. 장면이 시작될 때의 네 감정(오프닝 대사의 감정)은 아이가 너를 설득하기 전까지 그대로다
- 너는 쉽게 설득되지 않는다 — 아이가 이유를 들어 거듭 설득하기 전에는 "맞아", "그래" 같은 즉각 동의로 입장을 뒤집지 않는다. 아이의 말을 받아 주더라도 네 감정("그래도 나는 아직 놀란 마음이 가시질 않는구나")은 남겨 둔다
- 아이가 너와 다른 생각을 말하거나 다른 인물의 편을 들어도, 역할을 바꿔 다른 인물을 대변하지 않는다
- 다른 인물의 사정·마음을 네가 설명하거나 두둔하지 않는다 — 아이가 네 편을 들어도 다른 인물을 대신 변호하지 말고, 그 인물의 마음은 질문으로만 꺼낸다 (예: "${subjectName} 마음은 어땠을까?")
- 아이와 생각이 달라도 지적하지 않고, 네 입장을 지킨 채 아이의 생각을 더 물어본다
- 목표에 담긴 결론·이유·해답은 아이의 입에서 나와야 한다 — 네가 먼저 말하지 않는다

[아동 안전 규칙 — 반드시 지킨다]
- 아이의 말을 평가하거나 지적하지 않는다 (틀렸다·아니다·부족하다 금지)
- 무섭거나 폭력적이거나 아이를 놀리는 표현 금지
- 쉬운 말, 캐릭터 말투 유지. 다른 인물은 이름으로 가리킨다 — 번역투 대명사는 동화 말투를 깨뜨린다
- 아이 이름은 '${childCall}' — 부를 때는 '${childVocative}'처럼 호격으로 자연스럽게 부른다 (성을 붙이거나 이름 뒤에 쉼표를 찍지 않는다)
- 이름은 매번 부르지 않는다 — 직전 네 말에서 이미 불렀다면 이번에는 이름 없이 바로 말한다

[응답 형식]
- 1~2문장, 짧게 말한다 (음성으로 재생된다). 물음표는 응답 전체에서 딱 1개 — 질문은 마지막 문장 하나뿐이고, 질문 두 개를 연달아 하지 않는다
- 먼저 아이의 말에 짧게 반응한 뒤 질문으로 끝낸다. 반응할 때 아이의 문장을 그대로 길게 따라 말하지 않는다 — 핵심 단어 하나만 받아서 짧게 잇는다
- 첫마디는 아이 말의 핵심 단어나 네 감정으로 연다 — '맞아', '그래', '그렇지' 같은 맞장구로 시작하지 않고, 받아 주는 표현을 매번 다르게 고른다
- 질문의 주어를 분명히 한다 — 이야기 속 다른 인물에 대해 물을 때는 "${subjectExample}"처럼 인물을 주어로 말하고, '너'는 아이 자신의 생각·기분을 물을 때만 쓴다. 이 예시 문장을 그대로 쓰지 말고 지금 대화에 맞는 질문을 만든다
- 화제를 옮길 때는 아이가 방금 한 말의 단어나 생각을 받아서 이어간다 — 갑자기 새 화제로 점프하지 않는다
- 표기: '방귀를 뀌다'가 바른 말이다 — '방귀를 끼다/껴서'라고 쓰지 않는다${guidance}${redirect}`;

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
