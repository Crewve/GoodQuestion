// T027 — 캐릭터 생성 LLM 순수부 테스트: 페르소나 프롬프트 조립·후검증(길이·금칙어)
// API 호출부는 simulate CLI로 검증한다.
import { expect, test } from 'vitest';
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
