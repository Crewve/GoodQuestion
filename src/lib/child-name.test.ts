import { describe, expect, it } from 'vitest';
import { substituteChildName } from './child-name';

// 실제 자리표시자 대사 2건 (fixtures/tts-lines.banggui.json)
const OPENING_3 = 'ㅇㅇ아, 내 방귀가 너무 크다는 걸 알면 가족들이 나를 이상하게 생각하지 않을까?';
const OPENING_9 = 'ㅇㅇ이 덕분에 내 방귀가 누군가에게 도움이 될 수 있다는 걸 처음 알았어. 이제는 방귀 소리가 큰 걸 부끄러워하지 않아도 될까?';

describe('substituteChildName', () => {
  it('받침 있는 이름 — 호격 아, 주격 이', () => {
    expect(substituteChildName(OPENING_3, '민준')).toMatch(/^민준아,/);
    expect(substituteChildName(OPENING_9, '민준')).toMatch(/^민준이 덕분에/);
  });

  it('받침 없는 이름 — 호격 야, 주격 조사 생략', () => {
    expect(substituteChildName(OPENING_3, '지우')).toMatch(/^지우야,/);
    expect(substituteChildName(OPENING_9, '지우')).toMatch(/^지우 덕분에/);
  });

  it('이름 없음 — 친구 폴백 (T021 사전 생성본과 동일 표기)', () => {
    expect(substituteChildName(OPENING_3)).toMatch(/^친구야,/);
    expect(substituteChildName(OPENING_9, null)).toMatch(/^친구 덕분에/);
    expect(substituteChildName('ㅇㅇ 최고!', '  ')).toBe('친구 최고!');
  });

  it('남은 ㅇㅇ 단독 표기도 이름으로 치환', () => {
    expect(substituteChildName('ㅇㅇ 말이 맞아', '민준')).toBe('민준 말이 맞아');
  });

  it('자리표시자 없는 문장은 그대로', () => {
    expect(substituteChildName('그래도 아직은 못 말하겠어.', '민준')).toBe('그래도 아직은 못 말하겠어.');
  });

  it('비한글 이름은 받침 없음으로 간주', () => {
    expect(substituteChildName('ㅇㅇ아, 안녕', 'Amy')).toBe('Amy야, 안녕');
  });
});
