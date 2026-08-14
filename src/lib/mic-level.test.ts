import { describe, expect, it } from 'vitest';
import { MIC_LEVEL_FULL_RMS, WAVE_BAR_IDLE_RATIO, micLevelIntensity, waveBarHeight } from './mic-level';

describe('micLevelIntensity', () => {
  it('무입력·비정상 값은 0', () => {
    expect(micLevelIntensity(0)).toBe(0);
    expect(micLevelIntensity(-1)).toBe(0);
    expect(micLevelIntensity(Number.NaN)).toBe(0);
  });

  it('만점 기준 이상은 1로 클램프', () => {
    expect(micLevelIntensity(MIC_LEVEL_FULL_RMS)).toBe(1);
    expect(micLevelIntensity(0.9)).toBe(1);
  });

  it('입력이 커질수록 단조 증가한다', () => {
    const samples = [0.005, 0.01, 0.03, 0.06, 0.1].map((rms) => micLevelIntensity(rms));
    for (let i = 1; i < samples.length; i += 1) expect(samples[i]).toBeGreaterThan(samples[i - 1]);
  });

  it('사전 게이트 하한(0.01) 수준의 작은 입력도 눈에 띄는 값이 된다 (QA29)', () => {
    // 선형이면 0.08 — 제곱근 커브로 펴서 작은 소리도 표시가 움직이게 한다
    expect(micLevelIntensity(0.01)).toBeGreaterThan(0.25);
  });
});

describe('waveBarHeight', () => {
  it('유휴(0)에서는 기준 높이의 유휴 비율', () => {
    expect(waveBarHeight(26, 0, 0)).toBeCloseTo(26 * WAVE_BAR_IDLE_RATIO, 5);
  });

  it('기준 높이를 넘지 않고, 강한 입력에서는 기준 높이까지 커진다', () => {
    for (let i = 0; i < 6; i += 1) expect(waveBarHeight(26, 1, i)).toBeLessThanOrEqual(26);
    expect(waveBarHeight(26, 1, 1)).toBeCloseTo(26, 5);
  });

  it('강도에 따라 단조 증가한다', () => {
    const heights = [0, 0.25, 0.5, 0.75, 1].map((intensity) => waveBarHeight(20, intensity, 2));
    for (let i = 1; i < heights.length; i += 1) expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
  });

  it('낮은 바도 최소 두께 아래로 내려가지 않는다', () => {
    expect(waveBarHeight(8, 0, 0)).toBeGreaterThanOrEqual(4);
  });
});
