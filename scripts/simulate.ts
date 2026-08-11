// T029 — 대화 두뇌 시뮬레이션 CLI (R-13·R-17 데모 폴백 겸용)
// 대본(아이 발화 시퀀스) → 분석 → 후처리 → 규칙 판정 → 캐릭터 응답/고정 대사 루프를 텍스트로 출력한다.
// UI·DB 없이 파트2 전체 파이프라인을 단독 검증한다 (quickstart §2).
//
// 실행: npx tsx scripts/simulate.ts scripts/scenarios/happy-path.json
// 필요: OPENAI_API_KEY (.env.local)
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnvLocal, requireEnv } from './lib/env';
import storyFixture from '../fixtures/story.banggui.json';
import { rules as ruleThresholds } from '../src/lib/config';
import type { ThinkingElement } from '../src/lib/contracts';
import { analyzeUtterance } from '../src/lib/llm/analysis';
import { generateReply, loadCharacter } from '../src/lib/llm/generate';
import { postprocessAnalysis } from '../src/lib/llm/postprocess';
import { missionForScene } from '../src/lib/missions';
import { evaluateTurn, initialRuleState, type SceneRuleData } from '../src/lib/rules/engine';
import { evaluateMissionExposure, type MissionPhase } from '../src/lib/rules/mission';

type ScenarioTurn = string | { text: string; isMission?: boolean };

type Scenario = {
  scene: string;
  childName?: string;
  /** 문자열 또는 { text, isMission } — isMission=true는 미션 팝업 응답 제출 */
  turns: ScenarioTurn[];
};

async function main() {
  loadEnvLocal();
  requireEnv('OPENAI_API_KEY');

  const scenarioPath = process.argv[2];
  if (!scenarioPath) {
    console.error('사용법: npx tsx scripts/simulate.ts <시나리오.json>');
    process.exit(1);
  }
  const scenario: Scenario = JSON.parse(readFileSync(resolve(process.cwd(), scenarioPath), 'utf8'));

  const scene = storyFixture.scenes.find((s) => s.external_id === scenario.scene);
  if (!scene || scene.type !== 'dialogue') {
    console.error(`대화 장면이 아닙니다: ${scenario.scene}`);
    process.exit(1);
  }
  const character = loadCharacter(scene.character!);
  const sceneRule: SceneRuleData = {
    requiredElements: (scene.required_elements ?? []) as ThinkingElement[],
    maxTurns: scene.max_turns ?? 0,
  };

  console.log(`\n━━━ ${scene.label} (${scene.external_id}) · ${character.display_name} · required [${sceneRule.requiredElements.join(',')}] · 최대 ${sceneRule.maxTurns}턴 ━━━`);

  // 'ㅇㅇ' 자리표시자는 시뮬레이션에서 아이 이름/'친구야'로 치환해 표시 (R-07과 동일 원칙)
  const call = scenario.childName ?? '친구야';
  const opening = (scene.character_opening ?? '').replaceAll('ㅇㅇ', call);
  console.log(`\n🎭 ${character.name}: ${opening}`);

  // 미션 상태 (T041과 동일 로직 — /api/turn 미러)
  const mission = missionForScene(scene.external_id);
  let missionPhase: MissionPhase = null;
  if (mission) console.log(`   🗺️ 미션 장면: ${mission.id} 「${mission.title}」`);

  let state = initialRuleState();
  const history: { speaker: 'child' | 'character'; text: string }[] = [
    { speaker: 'character', text: opening },
  ];

  for (const turn of scenario.turns) {
    const { text: utterance, isMission = false } = typeof turn === 'string' ? { text: turn } : turn;
    if (isMission && missionPhase === 'exposed') missionPhase = 'completed';
    console.log(`\n🧒 아이${isMission ? ' (미션 응답)' : ''}: ${utterance}`);

    const raw = await analyzeUtterance(utterance, {
      sceneGoal: scene.scene_goal ?? '',
      characterName: character.name,
      characterQuestion: history.filter((h) => h.speaker === 'character').at(-1)?.text ?? '',
      requiredElements: sceneRule.requiredElements,
    });
    const { refined, dropped, correctedCount } = postprocessAnalysis(utterance, raw);
    history.push({ speaker: 'child', text: utterance });

    const detected = refined.detectedElements.map((element) => element.type);
    console.log(
      `   📊 분석: validity=${refined.utteranceValidity} intent=${refined.childIntent} 탐지=[${detected.join(',')}]` +
        (dropped.length ? ` 후처리 제거 ${dropped.length}건(${dropped.map((d) => `${d.type}:${d.reason}`).join(', ')})` : '') +
        (correctedCount ? ` 인용 보정 ${correctedCount}건` : ''),
    );

    const { decision, nextState, newElements } = evaluateTurn(state, sceneRule, refined, ruleThresholds);
    state = nextState;
    console.log(
      `   ⚖️ 판정: ${decision.mode}${decision.guidanceTarget ? `(유도→${decision.guidanceTarget})` : ''}${decision.sceneEndReason ? `(${decision.sceneEndReason})` : ''} ` +
        `턴 ${state.turnCount}/${sceneRule.maxTurns} 누적=[${state.accumulated.join(',')}] 부족=[${decision.missingElements.join(',')}]` +
        (newElements.length ? ` 신규=[${newElements.join(',')}]` : ''),
    );

    // ⑤-2 미션 판정 (T041 미러) — 미수행 GOAL_MET 보류, 종료 턴 미노출, 장면당 1회
    let effectiveDecision = decision;
    if (decision.mode === 'CLOSING' && decision.sceneEndReason === 'GOAL_MET' && mission && missionPhase !== 'completed') {
      effectiveDecision = { mode: 'NORMAL', missingElements: decision.missingElements };
      console.log('   🗺️ 미션 미수행 — GOAL_MET 종료 보류, 대화 계속');
    }
    const exposure =
      effectiveDecision.mode === 'CLOSING'
        ? { expose: false as const, reason: null }
        : evaluateMissionExposure({
            mission,
            missionPhase,
            turnCount: state.turnCount,
            detectedElements: detected,
            accumulated: state.accumulated,
            utteranceValidity: refined.utteranceValidity,
            consecutiveLowInformationTurns: state.consecutiveLowInformationTurns,
          });
    if (exposure.expose && mission) {
      missionPhase = 'exposed';
      console.log(`   🗺️ 미션 노출! ${mission.id} (사유: ${exposure.reason}) — 캐릭터 응답 없이 팝업 표시`);
      continue; // 노출 턴은 캐릭터 생성 없음 — 다음 대본 턴이 미션 응답
    }

    if (effectiveDecision.mode === 'CLOSING') {
      // R-04: CLOSING은 캐릭터 LLM 미호출 — 고정 character_closing 재생
      console.log(`\n🎭 ${character.name} (고정 클로징 — LLM 미호출): ${scene.character_closing}`);
      console.log(`\n장면 종료: ${effectiveDecision.sceneEndReason} (goal_met=${effectiveDecision.sceneEndReason === 'GOAL_MET'}, mission=${missionPhase ?? '없음'})`);
      return;
    }

    const reply = await generateReply({
      character,
      sceneGoal: scene.scene_goal ?? '',
      mode: effectiveDecision.mode,
      guidanceTarget: effectiveDecision.guidanceTarget,
      missingElements: effectiveDecision.missingElements,
      history,
      childName: scenario.childName,
    });
    history.push({ speaker: 'character', text: reply });
    console.log(`\n🎭 ${character.name}: ${reply}`);
  }

  console.log(`\n대본 소진 — 장면 미종료 (턴 ${state.turnCount}/${sceneRule.maxTurns}, 부족=[${sceneRule.requiredElements.filter((t) => !state.accumulated.includes(t)).join(',')}])`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
