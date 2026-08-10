// T028 — eval 골든 세트 회귀 러너. 프롬프트/모델 수정 시마다 실행한다 (quickstart §2).
// 실행: npx tsx eval/run.ts [--limit N] [--case id]
// 필요: OPENAI_API_KEY (.env.local)
//
// 판정 기준:
// - validity: expected와 정확 일치
// - elements: expected(핵심 최소 집합)의 재현율 — expected에 있는데 못 잡으면 miss.
//   expected 밖 추가 탐지는 extra로 보고만 하고 오답으로 치지 않는다 (탐지는 8요소 전체가 대상이므로).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvLocal, requireEnv } from '../scripts/lib/env';
import storyFixture from '../fixtures/story.banggui.json';
import charactersFixture from '../fixtures/characters.banggui.json';
import { analyzeUtterance } from '../src/lib/llm/analysis';
import { postprocessAnalysis } from '../src/lib/llm/postprocess';
import type { ThinkingElement } from '../src/lib/contracts';

type EvalCase = {
  id: string;
  scene: string;
  utterance: string;
  expected_elements: ThinkingElement[];
  expected_validity: string;
};

function sceneContext(sceneExternalId: string) {
  const scene = storyFixture.scenes.find((s) => s.external_id === sceneExternalId);
  if (!scene || scene.type !== 'dialogue') {
    throw new Error(`대화 장면이 아닙니다: ${sceneExternalId}`);
  }
  const character = charactersFixture.characters.find((c) => c.external_id === scene.character);
  return {
    sceneGoal: scene.scene_goal ?? '',
    characterName: character?.name ?? scene.character ?? '',
    characterQuestion: scene.character_opening ?? '',
    requiredElements: (scene.required_elements ?? []) as ThinkingElement[],
  };
}

async function main() {
  loadEnvLocal();
  requireEnv('OPENAI_API_KEY');

  const args = process.argv.slice(2);
  const limitIndex = args.indexOf('--limit');
  const caseIndex = args.indexOf('--case');
  const limit = limitIndex >= 0 ? Number(args[limitIndex + 1]) : Infinity;
  const onlyCase = caseIndex >= 0 ? args[caseIndex + 1] : null;

  const { cases } = JSON.parse(
    readFileSync(resolve(process.cwd(), 'eval/cases.json'), 'utf8'),
  ) as { cases: EvalCase[] };

  const selected = cases
    .filter((c) => (onlyCase ? c.id === onlyCase : true))
    .slice(0, limit);
  if (selected.length === 0) {
    console.error(onlyCase ? `케이스 없음: ${onlyCase}` : '케이스가 비어 있습니다.');
    process.exit(1);
  }

  let validityHits = 0;
  let recallSum = 0;
  const failures: string[] = [];

  for (const evalCase of selected) {
    const raw = await analyzeUtterance(evalCase.utterance, sceneContext(evalCase.scene));
    const { refined } = postprocessAnalysis(evalCase.utterance, raw);
    const detected = refined.detectedElements.map((element) => element.type);

    const validityOk = refined.utteranceValidity === evalCase.expected_validity;
    if (validityOk) validityHits += 1;

    const missed = evalCase.expected_elements.filter((type) => !detected.includes(type));
    const extra = detected.filter((type) => !evalCase.expected_elements.includes(type));
    const recall =
      evalCase.expected_elements.length === 0
        ? 1
        : (evalCase.expected_elements.length - missed.length) / evalCase.expected_elements.length;
    recallSum += recall;

    const ok = validityOk && missed.length === 0;
    const mark = ok ? '✔' : '✘';
    console.log(
      `${mark} ${evalCase.id.padEnd(22)} validity ${refined.utteranceValidity.padEnd(9)}${validityOk ? '' : `(기대 ${evalCase.expected_validity})`} ` +
        `탐지 [${detected.join(',')}]${missed.length ? ` miss:[${missed.join(',')}]` : ''}${extra.length ? ` extra:[${extra.join(',')}]` : ''}`,
    );
    if (!ok) failures.push(evalCase.id);
  }

  const n = selected.length;
  console.log('\n=== 요약 ===');
  console.log(`케이스 ${n}건 | validity 일치 ${validityHits}/${n} | 요소 재현율 평균 ${(recallSum / n * 100).toFixed(1)}%`);
  if (failures.length > 0) {
    console.log(`실패 케이스: ${failures.join(', ')}`);
    process.exit(2); // 회귀 감지 — 프롬프트 수정 후 재확인
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
