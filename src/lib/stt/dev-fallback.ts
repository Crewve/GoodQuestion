// 로컬 개발 전용 STT 폴백 (2026-08-13) — 게이트 실패(무의미한 소리·환각 차단 등) 시
// 장면 목표에 맞는 정석 예시 발화로 대체해, 아무 소리로도 이야기 진행을 확인할 수 있게 한다.
// NODE_ENV=development에서만 동작 — 스테이징·배포 빌드에서는 항상 null(게이트 실패 = 재녹음 유도 유지).
// 아래 문장은 사용자 노출 콘텐츠가 아니라 개발 리허설용 입력 값이라 fixtures 경유 규칙 대상이 아니다.

/** 대화 장면 정석 예시 — scene_goal·required_elements(fixtures/story.banggui.json)를 충족하는 발화 */
const DIALOGUE_EXAMPLES: Record<string, string> = {
  sc_banggui_03:
    '며느리는 가족들이 이상하게 볼까 봐 무서웠을 것 같아요. 방귀는 부끄러운 게 아니니까 참지 말고 솔직하게 말해 보면 좋겠어요.',
  sc_banggui_05:
    '시아버지도 많이 놀라셨을 것 같아요. 그런데 며느리가 일부러 그런 게 아니라 오래 참아서 그런 거니까 따뜻하게 이해해 주세요.',
  sc_banggui_07:
    '며느리의 큰 방귀로 배나무를 흔들면 배를 떨어뜨릴 수 있어요. 사람들이 다치지 않게 멀리 서 있다가 떨어진 배를 주우면 돼요.',
  sc_banggui_09:
    '처음에는 부끄러웠지만 방귀 덕분에 사람들을 도울 수 있어서 기뻤을 것 같아요. 나도 내 특징을 창피해하지 않고 좋은 일에 쓸 거예요.',
};

/** 미션 정석 예시 — mission_1(sc_banggui_07)·mission_2(sc_banggui_09, fixtures examples 중 1) */
const MISSION_EXAMPLES: Record<string, string> = {
  sc_banggui_07: '며느리가 방귀로 배나무를 흔들면 배가 떨어져서 마을 사람들이 나눠 먹을 수 있어요.',
  sc_banggui_09: '목소리가 큰 친구는 멀리 있는 사람을 부를 수 있어요.',
};

const RETELLING_EXAMPLE =
  '며느리는 가족들이 이상하게 볼까 봐 걱정하면서 방귀를 참았어요. 방귀가 터져서 모두 당황했지만, 지혜롭게 방귀로 배를 떨어뜨려 마을 사람들을 도왔고 시아버지도 사과했어요.'; // post_activity_config.keywords(걱정·당황·지혜·사과) 전부 포함 — ✓ 피드백 확인용

/**
 * 게이트 실패 시 대체할 정석 예시 발화 — 로컬 개발이 아니면 항상 null.
 * sceneId는 external_id(sc_*) 기준, 매핑이 없으면 컨텍스트별 첫 예시로 폴백한다.
 */
export function devSttFallbackText(context: string, sceneId?: string): string | null {
  if (process.env.NODE_ENV !== 'development') return null;
  if (context === 'retelling') return RETELLING_EXAMPLE;
  const map = context === 'mission' ? MISSION_EXAMPLES : DIALOGUE_EXAMPLES;
  return (sceneId && map[sceneId]) || Object.values(map)[0] || null;
}
