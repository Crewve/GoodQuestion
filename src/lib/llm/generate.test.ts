// T027 — 캐릭터 생성 LLM 순수부 테스트: 페르소나 프롬프트 조립·후검증(길이·금칙어)
// API 호출부는 simulate CLI로 검증한다.
import { expect, test } from 'vitest';
import charactersFixture from '../../../fixtures/characters.banggui.json';
import { buildGenerateMessages, loadCharacter, validateReply, type GenerateContext } from './generate';

function context(overrides: Partial<GenerateContext> = {}): GenerateContext {
  return {
    character: loadCharacter('ch_banggui_daughter_in_law'),
    sceneGoal: '며느리의 입장을 이해하고 공감한다',
    mode: 'NORMAL',
    missingElements: ['PERSPECTIVE', 'SOLUTION'],
    history: [
      { speaker: 'character', text: '가족들이 나를 이상하게 생각하지 않을까?' },
      { speaker: 'child', text: '많이 힘들었을 것 같아요' },
    ],
    ...overrides,
  };
}

test('fixtures 캐릭터를 external_id로 로드한다', () => {
  const character = loadCharacter('ch_banggui_daughter_in_law');
  expect(character.name).toBe('며느리');
  expect(character.traits.length).toBeGreaterThan(0);
});

test('없는 캐릭터 external_id는 즉시 throw (오탈자 조기 발견)', () => {
  expect(() => loadCharacter('ch_없는_캐릭터')).toThrow();
});

test('시스템 프롬프트에 페르소나(tagline·traits)와 장면 목표가 반영된다', () => {
  const messages = buildGenerateMessages(context());
  const system = messages[0].content;
  expect(system).toContain('며느리');
  expect(system).toContain('자신의 모습을 조금씩 받아들이는'); // tagline 일부
  expect(system).toContain('며느리의 입장을 이해하고 공감한다');
});

test('아동 안전 가드레일이 시스템 프롬프트에 포함된다 (평가·지적 금지)', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).toContain('평가');
  expect(system).toContain('지적');
});

test('역할 유지 규칙이 시스템 프롬프트에 포함된다 — 아이가 다른 인물 편을 들어도 역할 이탈 금지 (T073, E2E 항목 17)', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).toContain('역할 유지');
  expect(system).toContain('대변하지 않는다');
  expect(system).toContain('입장');
});

test('화제 전환 브릿지 규칙이 포함된다 — 직전 발화를 받아 연결, 점프 금지 (T073, E2E 항목 22)', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).toContain('방금 한 말');
  expect(system).toContain('점프');
});

test('점진적 설득 규칙 — 즉각 동의로 입장을 뒤집지 않는다 (T073 후속, 시아버지 과속 동의 제보)', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).toContain('쉽게 설득되지 않는다');
});

test('질문 주어 명확화 — 인물 질문에 "너" 오용 금지 (T073 후속, "너는 왜 참았을까" 제보)', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).toContain('주어를 분명히');
});

// ── C1 (LLM 생성 표현 고도화) — staging 로그 어색 패턴 기반 프롬프트 규칙 ──

test('C1-P1: 자기 3인칭 지칭 금지 — 며느리가 자신을 "며느리"라 부르지 않는다 (staging: "며느리도 그런 마음이…")', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).toContain('3인칭');
  // 자기 마음을 묻는 것 자체는 장면 설계상 필요(요소 유도) — 단 1인칭으로 묻는다
  expect(system).toContain("'나'로 묻는다");
});

test('C1-P1 예시 오염 방지: 주어 예시는 fixtures에서 화자 아닌 인물로 파생 — 전 캐릭터 불변식 (리뷰 필수 2)', () => {
  for (const c of charactersFixture.characters) {
    const system = buildGenerateMessages(context({ character: loadCharacter(c.external_id) }))[0].content;
    // 중립 템플릿 사용 (스포일러·오프씬 사건 예시 금지) + 예시 주어는 화자 자신이 아니어야 한다
    expect(system).toMatch(/왜 그랬을까\?/);
    expect(system).not.toContain(`${c.name}은 왜 그랬을까`);
    expect(system).not.toContain(`${c.name}는 왜 그랬을까`);
  }
});

test('C1 리뷰 필수 1: redirect 시 [주제 복귀]가 핵심 단어 에코 규칙보다 우선한다고 명시된다', () => {
  for (const redirect of ['INAPPROPRIATE', 'OFF_TOPIC'] as const) {
    const system = buildGenerateMessages(context({ redirect }))[0].content;
    expect(system).toContain('우선');
    expect(system).toContain('되받지 않는다');
  }
});

test('C1 리뷰 필수 3: 조사 비문 없음 — "마을 이장님"에 \'라고\'를 붙이지 않는다', () => {
  const system = buildGenerateMessages(
    context({ character: loadCharacter('ch_banggui_village_chief') }),
  )[0].content;
  expect(system).not.toContain("'마을 이장님'라고");
});

test('C1 리뷰 권고: 호격 예시는 확정 렌더 — "서윤아", 슬래시 미노출', () => {
  const system = buildGenerateMessages(context({ childName: '김서윤' }))[0].content;
  expect(system).toContain("'서윤아'");
  expect(system).not.toContain('아/야');
});

test('C1 리뷰 권고: 타 인물 마음 예시도 이름 사용 — "그 사람" 대명사 예시 제거', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).toContain('시아버지 마음은 어땠을까');
  expect(system).not.toContain('그 사람 마음은');
});

test('C1-P5 강화: 아이가 네 편을 들어도 다른 인물을 대신 변호하지 않는다 (simulate 회귀: 시아버지 "그녀도 힘들었던 거야")', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).toContain('네 편을 들어도');
});

test('C1 번역투 금지 — "그녀" 같은 번역투 대명사를 쓰지 않는다 (simulate 회귀: 시아버지 "그녀도")', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).toContain('번역투');
});

test('C1-P2: 질문은 물음표 1개 — 한 턴 질문 2개 연발 금지 (staging: "편해질까? …궁금해.")', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).toContain('물음표');
  expect(system).toContain('마지막 문장');
});

test('C1-P3: 호명 빈도 제한 — 매 턴 이름으로 시작하지 않는다 (staging: 10턴 중 7턴 "정진욱,")', () => {
  const system = buildGenerateMessages(context({ childName: '김서윤' }))[0].content;
  expect(system).toContain('매번 부르지 않는다');
});

test('C1-P4: "맞아/그래/그렇지" 첫마디 맞장구 금지 — 정답 판정형 동의로 시작하지 않는다 (staging 4건 + simulate 회귀 재발)', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).toContain('첫마디');
  expect(system).toContain("'그렇지'");
});

test('C1-P7: 아이 문장 장황 에코 금지 — 핵심 단어만 받아 짧게 잇는다 (staging: 비문 에코 3건)', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).toContain('핵심 단어');
});

test('C1-P9: 표기 고정 — "방귀를 뀌다" (staging: 캐릭터가 "방귀를 끼는/껴야" 생성 2건)', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).toContain("'방귀를 뀌다'");
});

test('C1 보조: childName 없으면 호격 지시가 "친구야아/야"로 깨지지 않는다', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).not.toContain('친구야아');
});

test('아이 호칭은 성 제외 이름 — "김서윤" → "서윤" (홈 인사말 givenName 규칙과 동일)', () => {
  const system = buildGenerateMessages(context({ childName: '김서윤' }))[0].content;
  expect(system).toContain("'서윤'");
  expect(system).not.toContain('김서윤');
});

test('GUIDED면 서버가 지정한 부족 요소만 유도 지시에 등장한다', () => {
  const messages = buildGenerateMessages(
    context({ mode: 'GUIDED', guidanceTarget: 'PERSPECTIVE', missingElements: ['PERSPECTIVE', 'SOLUTION'] }),
  );
  const all = messages.map((m) => m.content).join('\n');
  expect(all).toContain('PERSPECTIVE');
  // 유도는 최대 1~2개 — 지정 대상 외 요소(RESULT 등)는 유도 지시에 없어야 한다
  expect(all).not.toContain('RESULT');
});

test('NORMAL이면 유도 지시가 없다', () => {
  const all = buildGenerateMessages(context())
    .map((m) => m.content)
    .join('\n');
  expect(all).not.toContain('유도');
});

test('redirect=INAPPROPRIATE면 따라 말하지 않기·주제 복귀 지시가 들어간다 (T075, E2E 항목 24)', () => {
  const system = buildGenerateMessages(context({ redirect: 'INAPPROPRIATE' }))[0].content;
  expect(system).toContain('주제 복귀');
  expect(system).toContain('따라 말하');
  expect(system).toContain('나무라지');
});

test('redirect=OFF_TOPIC도 주제 복귀 지시가 들어간다', () => {
  const system = buildGenerateMessages(context({ redirect: 'OFF_TOPIC' }))[0].content;
  expect(system).toContain('주제 복귀');
});

test('redirect가 없으면 주제 복귀 지시가 없다', () => {
  const system = buildGenerateMessages(context())[0].content;
  expect(system).not.toContain('주제 복귀');
});

test('대화 내역이 messages로 전달된다', () => {
  const messages = buildGenerateMessages(context());
  const all = messages.map((m) => m.content).join('\n');
  expect(all).toContain('많이 힘들었을 것 같아요');
});

test('후검증: 정상 응답은 통과한다', () => {
  expect(validateReply('그렇게 말해 주니 고마워. 너라면 어떻게 하겠니?')).toEqual({ ok: true });
});

test('후검증: 빈 응답은 EMPTY', () => {
  expect(validateReply('   ')).toEqual({ ok: false, reason: 'EMPTY' });
});

test('후검증: 길이 초과는 TOO_LONG (TTS 지연·아동 집중 보호)', () => {
  expect(validateReply('가'.repeat(200))).toEqual({ ok: false, reason: 'TOO_LONG' });
});

test('후검증: 금칙어 포함은 BANNED_WORD', () => {
  expect(validateReply('바보 같은 소리 하지 마')).toEqual({ ok: false, reason: 'BANNED_WORD' });
});
