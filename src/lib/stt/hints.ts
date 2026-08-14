// 장면별 Whisper prompt 힌트 빌더 (T014) — 캐릭터명·직전 대사를 주입해 아동 발화 인식률을 높인다 (stt_analysis §3).
// 콘텐츠는 fixtures에서만 가져온다(하드코딩 금지). Whisper는 prompt의 "마지막" 224토큰만 사용하므로
// 중요한 어휘(캐릭터명·제목)를 뒤쪽에 배치하고, 길이 초과 시 앞에서부터 자른다.
import story from "../../../fixtures/story.banggui.json";
import characters from "../../../fixtures/characters.banggui.json";

// 한국어는 대략 1글자 ≈ 1토큰 이상으로 토크나이즈되는 경우가 많아 보수적으로 자수 제한 (≤224토큰 안전권)
const MAX_HINT_CHARS = 180;

type Scene = {
  external_id: string;
  type: string;
  label: string;
  narration?: string;
  character?: string;
  character_opening?: string;
};

type Character = { external_id: string; name: string; display_name: string };

const scenes = (story as { scenes: Scene[] }).scenes;
const characterList = (characters as { characters: Character[] }).characters;

/** 항상 포함되는 기본 어휘 — 이야기 제목·주제·캐릭터 표시명 */
function baseVocabulary(): string[] {
  const meta = (story as { story: { title: string; topics?: string[] } }).story;
  return [
    ...characterList.map((c) => c.display_name),
    ...(meta.topics ?? []),
    meta.title,
  ];
}

/**
 * 장면별 STT 힌트 생성.
 * @param sceneExternalId 예: 'sc_banggui_03' — 미지정 시 기본 어휘만
 * @param characterReply  직전 캐릭터 대사(GUIDED 추가 질문 등) — 있으면 장면 오프닝 대신 사용.
 *                        아이 발화는 항상 캐릭터 대사에 대한 응답이므로 가장 강한 문맥 힌트가 된다.
 */
export function buildSttHint(sceneExternalId?: string, characterReply?: string): string {
  const scene = sceneExternalId ? scenes.find((s) => s.external_id === sceneExternalId) : undefined;
  const context = characterReply ?? scene?.character_opening ?? scene?.narration ?? "";

  // Whisper는 prompt 끝부분을 조건으로 쓰므로 [문맥 → 기본 어휘] 순서로 배치
  const hint = [context, ...baseVocabulary()].filter(Boolean).join(", ");
  return hint.length > MAX_HINT_CHARS ? hint.slice(hint.length - MAX_HINT_CHARS) : hint;
}
