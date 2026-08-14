// 마이크 입력 레벨 표시 변환 (QA29) — useRecorder가 재는 RMS(0~1)를 화면 표시용 강도(0~1)로 옮긴다.
// 아이 발화 RMS는 대략 0.01~0.12 구간(사전 게이트 하한 0.01)이라 원본을 그대로 배율에 쓰면
// 표시가 거의 움직이지 않는다 — 만점 기준으로 나눈 뒤 제곱근 커브로 펴서 작은 소리도 눈에 보이게 한다.

/** 표시 만점 기준 RMS — 이 값 이상이면 강도 1 (아이 목소리 실측 상단) */
export const MIC_LEVEL_FULL_RMS = 0.12;

/** 웨이브 바 유휴 높이 비율 — 소리가 없을 때도 바 형태는 남긴다 */
export const WAVE_BAR_IDLE_RATIO = 0.4;

/** 웨이브 바 최소 두께(px) — 짧은 바가 선으로 뭉개지지 않게 */
export const WAVE_BAR_MIN_PX = 4;

/** RMS(0~1) → 표시 강도(0~1). 비정상 값·무음은 0, 만점 기준 이상은 1. */
export function micLevelIntensity(rms: number, fullRms: number = MIC_LEVEL_FULL_RMS): number {
  if (!Number.isFinite(rms) || rms <= 0) return 0;
  return Math.min(1, Math.sqrt(rms / fullRms));
}

/**
 * 웨이브 바 높이 — 유휴 비율에서 시작해 강도에 따라 기준 높이까지 자란다.
 * 바마다 반응 폭(reach)을 달리해 같은 강도에서도 파형처럼 들쭉날쭉하게 보이게 한다.
 */
export function waveBarHeight(baseHeight: number, intensity: number, index: number): number {
  const reach = 0.85 + (index % 3) * 0.15;
  const gain = WAVE_BAR_IDLE_RATIO + (1 - WAVE_BAR_IDLE_RATIO) * Math.min(1, Math.max(0, intensity) * reach);
  return Math.max(WAVE_BAR_MIN_PX, baseHeight * gain);
}
