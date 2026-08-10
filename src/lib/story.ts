// 이야기 fixture ↔ DB uuid 매핑 헬퍼 (T031/T032 공용)
// DB에는 external_id가 없으므로, fixtures의 external_id를 결정적 uuid(external-id.ts)로 계산해
// 양방향 조회를 제공한다. 콘텐츠(장면 텍스트·미션)는 DB가, 에셋 키·캐릭터 페르소나는 fixtures가 SoT.
import storyFixture from '../../fixtures/story.banggui.json';
import { externalIdToUuid } from './external-id';

export type FixtureScene = {
  external_id: string;
  scene_order: number;
  type: 'narration' | 'dialogue';
  label: string;
  narration?: string;
  character?: string;
  character_opening?: string;
  character_closing?: string;
  scene_goal?: string;
  required_elements?: string[];
  max_turns?: number;
  preferred_turns?: number | null;
  mission?: string | null;
};

const scenes = storyFixture.scenes as FixtureScene[];

const byUuid = new Map<string, FixtureScene>(
  scenes.map((scene) => [externalIdToUuid(scene.external_id), scene]),
);

/** 장면 uuid → fixture 장면. 시드되지 않은 uuid면 null */
export function fixtureSceneByUuid(sceneId: string): FixtureScene | null {
  return byUuid.get(sceneId) ?? null;
}

/** 시드된 이야기 uuid (방귀 뀌는 며느리 1편) */
export const BANGGUI_STORY_ID = externalIdToUuid(storyFixture.story.external_id);
