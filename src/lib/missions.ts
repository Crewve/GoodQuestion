// 미션 설정 로더 (T039, R-11-3) — DB 테이블 신설 대신 fixtures의 missions 키를 서버 설정으로 로드.
// 장면 매핑(대화3=미션1, 대화4=미션2)은 fixture의 scene 필드에서 파생 — 하드코딩 금지 원칙.
// mission_1은 expose_conditions(4종 판정형), mission_2는 expose_timing(발화 흐름 서술형)으로
// 원본 스키마가 다르다 — 노출 판정(T040)이 소비하기 쉽도록 공통 타입으로 정규화해 노출한다.
import storyFixture from '../../fixtures/story.banggui.json';

export type MissionId = 'mission_1' | 'mission_2';

export type Mission = {
  id: MissionId;
  title: string;
  /** 노출 장면 external_id (sc_banggui_07 | sc_banggui_09) */
  sceneExternalId: string;
  goal: string;
  /** 미션1: 응답에서 확인할 구성 요소 안내 */
  guidePoints: string[];
  /** 미션1: 판정형 노출 조건 4종 (기획 '미션 노출 기준' 공통 조건) */
  exposeConditions: string[];
  /** 미션2: 예시 문장 (팝업 콘텐츠용) */
  examples: string[];
  /** 노출 원칙/시점 서술 (원문 보존 — 프롬프트·문서화용) */
  exposeNote?: string;
  /** 미션 결과 활용 방침 (정답 판정 아님 — 요소 확인) */
  resultUsage?: string;
};

type RawMission = {
  title: string;
  scene: string;
  goal: string;
  guide_points?: string[];
  expose_principle?: string;
  expose_conditions?: string[];
  examples?: string[];
  purpose?: string;
  expose_timing?: string;
  result_usage?: string;
};

const rawMissions = (storyFixture as unknown as { missions: Record<string, RawMission> }).missions;

function normalize(id: MissionId, raw: RawMission): Mission {
  return {
    id,
    title: raw.title,
    sceneExternalId: raw.scene,
    goal: raw.goal,
    guidePoints: raw.guide_points ?? [],
    exposeConditions: raw.expose_conditions ?? [],
    examples: raw.examples ?? [],
    exposeNote: raw.expose_principle ?? raw.expose_timing,
    resultUsage: raw.result_usage,
  };
}

const missions = new Map<MissionId, Mission>(
  (Object.entries(rawMissions) as [MissionId, RawMission][]).map(([id, raw]) => [id, normalize(id, raw)]),
);

const missionsByScene = new Map<string, Mission>(
  [...missions.values()].map((mission) => [mission.sceneExternalId, mission]),
);

/** 미션 id → 정의. 미등록 id는 오탈자일 가능성이 높아 즉시 throw (assets.ts와 동일 원칙) */
export function loadMission(id: MissionId): Mission {
  const mission = missions.get(id);
  if (!mission) throw new Error(`fixtures missions에 없는 id: ${id}`);
  return mission;
}

/** 장면 external_id → 해당 장면의 미션. 미션 없는 장면은 null (대화1·대화2) */
export function missionForScene(sceneExternalId: string): Mission | null {
  return missionsByScene.get(sceneExternalId) ?? null;
}
