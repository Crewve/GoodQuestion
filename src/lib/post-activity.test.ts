// T052 학습완료 활동 판정 로직 테스트 — contracts/api-routes.md POST /api/post-activity·R-09 스키마.
import { describe, expect, test } from 'vitest';
import {
  judgeCardOrder,
  parsePostActivityConfig,
  parsePostActivityRequest,
  type PostActivityConfig,
} from './post-activity';

// fixtures/story.banggui.json의 임시 저작본(T051)과 같은 형태
const config: PostActivityConfig = {
  cards: [
    { id: 'sc_banggui_02', image_key: 'stories/banggui/scenes/sc_banggui_02.png', label: '방귀를 꾹꾹 참았어요' },
    { id: 'sc_banggui_04', image_key: 'stories/banggui/scenes/sc_banggui_04.png', label: '방귀가 펑 하고 터졌어요' },
    { id: 'sc_banggui_06', image_key: 'stories/banggui/scenes/sc_banggui_06.png', label: '높은 배나무를 만났어요' },
    { id: 'sc_banggui_08', image_key: 'stories/banggui/scenes/sc_banggui_08.png', label: '특별한 힘을 알게 됐어요' },
  ],
  answer_order: ['sc_banggui_02', 'sc_banggui_04', 'sc_banggui_06', 'sc_banggui_08'],
  keywords: ['방귀', '갓', '배나무', '특별한 힘'],
};

describe('parsePostActivityConfig — stories.post_activity_config JSON 검증 (R-09)', () => {
  test('정상 config는 그대로 반환', () => {
    expect(parsePostActivityConfig(config)).toEqual(config);
  });

  test('null·비객체·필드 누락은 null (콘텐츠 미저작 이야기)', () => {
    expect(parsePostActivityConfig(null)).toBeNull();
    expect(parsePostActivityConfig('config')).toBeNull();
    expect(parsePostActivityConfig({ cards: config.cards })).toBeNull();
  });

  test('answer_order에 cards에 없는 id가 있으면 null', () => {
    expect(
      parsePostActivityConfig({ ...config, answer_order: ['sc_banggui_02', 'sc_banggui_04', 'sc_banggui_06', 'sc_x'] }),
    ).toBeNull();
  });

  test('cards·answer_order·keywords 길이가 서로 다르면 null (2.4.5 4세트 쌍)', () => {
    expect(parsePostActivityConfig({ ...config, answer_order: config.answer_order.slice(0, 3) })).toBeNull();
    expect(parsePostActivityConfig({ ...config, keywords: config.keywords.slice(0, 3) })).toBeNull();
  });
});

describe('judgeCardOrder — 서버 정답 판정 (프런트 판정 금지, FR-016)', () => {
  test('answer_order와 위치까지 일치하면 정답', () => {
    expect(judgeCardOrder(config, ['sc_banggui_02', 'sc_banggui_04', 'sc_banggui_06', 'sc_banggui_08'])).toBe(true);
  });

  test('순서가 다르면 오답', () => {
    expect(judgeCardOrder(config, ['sc_banggui_04', 'sc_banggui_02', 'sc_banggui_06', 'sc_banggui_08'])).toBe(false);
  });

  test('길이가 다르면 오답 (슬롯 4개 모두 채워졌을 때만 제출이 계약)', () => {
    expect(judgeCardOrder(config, ['sc_banggui_02', 'sc_banggui_04', 'sc_banggui_06'])).toBe(false);
  });
});

describe('parsePostActivityRequest — 요청 본문 판별 (kind별 계약)', () => {
  test('card-order 정상 요청', () => {
    const result = parsePostActivityRequest({
      sessionId: 'uuid-1',
      kind: 'card-order',
      submittedOrder: ['a', 'b', 'c', 'd'],
    });
    expect(result).toEqual({
      ok: true,
      value: { kind: 'card-order', sessionId: 'uuid-1', submittedOrder: ['a', 'b', 'c', 'd'] },
    });
  });

  test('card-order: submittedOrder가 비었거나 문자열 배열이 아니면 거절', () => {
    expect(parsePostActivityRequest({ sessionId: 'uuid-1', kind: 'card-order', submittedOrder: [] }).ok).toBe(false);
    expect(parsePostActivityRequest({ sessionId: 'uuid-1', kind: 'card-order', submittedOrder: [1, 2, 3, 4] }).ok).toBe(false);
    expect(parsePostActivityRequest({ sessionId: 'uuid-1', kind: 'card-order' }).ok).toBe(false);
  });

  test('retelling 정상 요청 — 앞뒤 공백은 저장 전에 정리', () => {
    const result = parsePostActivityRequest({
      sessionId: 'uuid-1',
      kind: 'retelling',
      retellingText: '  며느리가 방귀를 참다가 크게 뀌었어요  ',
    });
    expect(result).toEqual({
      ok: true,
      value: { kind: 'retelling', sessionId: 'uuid-1', retellingText: '며느리가 방귀를 참다가 크게 뀌었어요' },
    });
  });

  test('retelling: 공백뿐인 텍스트는 거절 (2.4.5 보내기 활성 조건)', () => {
    expect(parsePostActivityRequest({ sessionId: 'uuid-1', kind: 'retelling', retellingText: '   ' }).ok).toBe(false);
    expect(parsePostActivityRequest({ sessionId: 'uuid-1', kind: 'retelling' }).ok).toBe(false);
  });

  test('sessionId 누락·미지원 kind는 거절', () => {
    expect(parsePostActivityRequest({ kind: 'card-order', submittedOrder: ['a'] }).ok).toBe(false);
    expect(parsePostActivityRequest({ sessionId: 'uuid-1', kind: 'quiz' }).ok).toBe(false);
    expect(parsePostActivityRequest(null).ok).toBe(false);
  });
});
