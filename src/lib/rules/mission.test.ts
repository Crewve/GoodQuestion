import { describe, expect, it } from 'vitest';
import { loadMission, missionForScene } from '../missions';
import { evaluateMissionExposure, type MissionExposureInput } from './mission';

const mission1 = loadMission('mission_1');
const mission2 = loadMission('mission_2');

function input(overrides: Partial<MissionExposureInput> = {}): MissionExposureInput {
  return {
    mission: mission1,
    missionPhase: null,
    turnCount: 1,
    detectedElements: [],
    accumulated: [],
    utteranceValidity: 'VALID',
    consecutiveLowInformationTurns: 0,
    ...overrides,
  };
}

describe('evaluateMissionExposure — 공통', () => {
  it('미션 없는 장면은 노출하지 않는다 (대화1·대화2)', () => {
    expect(missionForScene('sc_banggui_03')).toBeNull();
    const d = evaluateMissionExposure(input({ mission: null, detectedElements: ['SOLUTION'] }));
    expect(d.expose).toBe(false);
  });

  it('완료된 미션은 재노출하지 않는다 (장면당 1회 완료)', () => {
    const d = evaluateMissionExposure(input({ missionPhase: 'completed', detectedElements: ['SOLUTION'] }));
    expect(d.expose).toBe(false);
  });

  it('노출됐지만 미완료(exposed)면 재노출한다 — 새로고침·재진입으로 팝업이 유실돼도 복구 (T074, E2E 항목 21)', () => {
    const d = evaluateMissionExposure(input({ missionPhase: 'exposed', detectedElements: [] }));
    expect(d).toEqual({ expose: true, reason: 'REEXPOSED' });
  });

  it('재노출은 미션2에도 동일 적용된다', () => {
    const d = evaluateMissionExposure(
      input({ mission: mission2, missionPhase: 'exposed', utteranceValidity: 'PLAYFUL' }),
    );
    expect(d).toEqual({ expose: true, reason: 'REEXPOSED' });
  });
});

describe('mission_1 (대화3) — 노출 조건 4종', () => {
  it('조건① 해결 방법(SOLUTION) 제안 시 즉시 노출', () => {
    const d = evaluateMissionExposure(input({ detectedElements: ['SOLUTION'], accumulated: ['SOLUTION'] }));
    expect(d).toEqual({ expose: true, reason: 'SOLUTION_PROPOSED' });
  });

  it('조건② 방향(REASON·DECISION)만 있고 SOLUTION 미누적이면 노출', () => {
    const d = evaluateMissionExposure(input({ detectedElements: ['REASON'], accumulated: ['REASON'] }));
    expect(d).toEqual({ expose: true, reason: 'DIRECTION_ONLY' });
  });

  it('1턴에 관련 요소가 없으면 아직 노출하지 않는다', () => {
    const d = evaluateMissionExposure(input({ detectedElements: ['EMOTION'], accumulated: ['EMOTION'] }));
    expect(d.expose).toBe(false);
  });

  it('조건③ 2턴 이상 대화했지만 SOLUTION 미누적이면 노출', () => {
    const d = evaluateMissionExposure(
      input({ turnCount: 2, detectedElements: ['EMOTION'], accumulated: ['EMOTION'] }),
    );
    expect(d).toEqual({ expose: true, reason: 'NO_METHOD_AFTER_TURNS' });
  });

  it('조건④ 연속 저정보 2턴이면 노출 (질문만으로 구체화 어려움)', () => {
    const d = evaluateMissionExposure(
      input({
        turnCount: 2,
        accumulated: ['SOLUTION'], // ③ 비적용 상황에서도 ④가 독립 동작
        utteranceValidity: 'SHORT',
        consecutiveLowInformationTurns: 2,
      }),
    );
    expect(d).toEqual({ expose: true, reason: 'HARD_TO_CONCRETIZE' });
  });
});

describe('mission_2 (대화4) — 자기 긍정 발화 후 노출', () => {
  it('VALID 발화에서 REASON·EMOTION·PERSPECTIVE 탐지 시 노출', () => {
    const d = evaluateMissionExposure(
      input({ mission: mission2, detectedElements: ['REASON'], accumulated: ['REASON'] }),
    );
    expect(d).toEqual({ expose: true, reason: 'SELF_AFFIRMATION_STATED' });
  });

  it('비유효(PLAYFUL) 발화면 1턴엔 노출하지 않고, 2턴 폴백으로 노출한다', () => {
    const first = evaluateMissionExposure(
      input({ mission: mission2, detectedElements: ['REASON'], utteranceValidity: 'PLAYFUL' }),
    );
    expect(first.expose).toBe(false);
    const second = evaluateMissionExposure(
      input({ mission: mission2, turnCount: 2, utteranceValidity: 'PLAYFUL' }),
    );
    expect(second).toEqual({ expose: true, reason: 'NO_METHOD_AFTER_TURNS' });
  });
});
