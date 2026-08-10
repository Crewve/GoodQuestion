// T008 — fixtures/story.banggui.json → stories/story_scenes 시드 (멱등 upsert)
// 실행: npx tsx scripts/seed.ts
//
// - external_id→uuid는 결정적 매핑(src/lib/external-id)이라 재실행해도 같은 행을 갱신한다.
// - 임시 채택값(R-08): 대화2 요소=장면 테이블(fixtures에 반영됨), EXPRESSION→REASON(동일),
//   preferred_turns=null → max_turns 동일값(참고용 필드 — 규칙 엔진 종료 판정 미사용).
// - 미션 정의는 DB에 넣지 않는다(R-11-3 — 서버가 fixtures를 직접 로드).
// - 콘텐츠 하드코딩 금지: 이 스크립트는 fixtures 값을 옮기기만 한다.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { externalIdToUuid } from '../src/lib/external-id';
import { createServiceClient } from './lib/supabase';

type FixtureScene = {
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
};

type StoryFixture = {
  story: {
    external_id: string;
    title: string;
    summary: string;
    difficulty: string;
    topics: string[];
    estimated_minutes: number;
    status: string;
    post_activity_config: unknown;
  };
  scenes: FixtureScene[];
};

function sceneType(scene: FixtureScene): '도입' | '전개' | '대화' {
  if (scene.type === 'dialogue') return '대화';
  return scene.label === '도입' ? '도입' : '전개';
}

async function main() {
  const fixture: StoryFixture = JSON.parse(
    readFileSync(resolve(process.cwd(), 'fixtures/story.banggui.json'), 'utf8'),
  );
  const supabase = createServiceClient();

  const storyId = externalIdToUuid(fixture.story.external_id);
  const { error: storyError } = await supabase.from('stories').upsert(
    {
      id: storyId,
      title: fixture.story.title,
      summary: fixture.story.summary,
      difficulty: fixture.story.difficulty,
      topics: fixture.story.topics,
      estimated_minutes: fixture.story.estimated_minutes,
      status: fixture.story.status,
      post_activity_config: fixture.story.post_activity_config, // 현재 null — T051에서 임시 저작(R-09)
    },
    { onConflict: 'id' },
  );
  if (storyError) throw new Error(`stories upsert 실패: ${storyError.message}`);

  const sceneRows = fixture.scenes.map((scene) => ({
    id: externalIdToUuid(scene.external_id),
    story_id: storyId,
    scene_order: scene.scene_order,
    scene_type: sceneType(scene),
    // NOT NULL 스키마 대응: 유형에 없는 필드는 빈 값으로 채운다 (데이터 부재의 의미는 scene_type이 가짐)
    scene_description: scene.narration ?? '',
    conflict: '',
    character_name: scene.character ?? '',
    character_opening: scene.character_opening ?? '',
    character_closing: scene.character_closing ?? '',
    scene_goal: scene.scene_goal ?? '',
    required_elements: scene.required_elements ?? [],
    max_turns: scene.max_turns ?? 0,
    preferred_turns: scene.preferred_turns ?? scene.max_turns ?? 0, // R-08 ③
  }));

  const { error: sceneError } = await supabase
    .from('story_scenes')
    .upsert(sceneRows, { onConflict: 'id' });
  if (sceneError) throw new Error(`story_scenes upsert 실패: ${sceneError.message}`);

  // 검증 출력 — external_id→uuid 매핑과 시드 결과 요약
  const { data: scenes, error: verifyError } = await supabase
    .from('story_scenes')
    .select('id, scene_order, scene_type, character_name, required_elements, max_turns')
    .eq('story_id', storyId)
    .order('scene_order');
  if (verifyError) throw new Error(`검증 조회 실패: ${verifyError.message}`);

  console.log(`✔ story  ${fixture.story.title} → ${storyId}`);
  for (const scene of fixture.scenes) {
    const row = scenes?.find((r) => r.id === externalIdToUuid(scene.external_id));
    if (!row) throw new Error(`시드 후 행 미발견: ${scene.external_id}`);
    console.log(
      `✔ scene ${String(row.scene_order).padStart(2)} [${row.scene_type}] ${scene.external_id} → ${row.id}` +
        (row.scene_type === '대화' ? ` (${row.character_name}, 요소 ${row.required_elements.length}, 최대 ${row.max_turns}턴)` : ''),
    );
  }
  console.log(`합계: scenes ${scenes?.length ?? 0}/9`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
