// 에셋 URL 헬퍼 (T011) — Supabase Storage `story-assets` 버킷 공개 URL 조합.
// 매핑 SoT는 fixtures/storage-assets.json (업로드 스크립트 scripts/upload_story_assets.py와 쌍).
// 공개 URL만 다루므로 클라이언트/서버 모두 사용 가능.
import storageAssets from "../../fixtures/storage-assets.json";

const BASE_URL: string = storageAssets.base_url;
const KNOWN_KEYS = new Set(storageAssets.assets.map((a) => a.key));

/** 버킷 key → 공개 URL. 매핑에 없는 키는 오탈자일 가능성이 높아 즉시 throw (조기 발견). */
export function assetUrl(key: string): string {
  if (!KNOWN_KEYS.has(key)) {
    throw new Error(`storage-assets.json에 없는 키: ${key}`);
  }
  return `${BASE_URL}/${key}`;
}

/**
 * 장면 이미지 — story_scenes.external_id 기준.
 * 대화3(sc_banggui_07)만 결과 연출 포함 2컷(-1/-2), 나머지는 단일 컷.
 */
export function sceneImageUrl(sceneExternalId: string, variant: 1 | 2 = 1): string {
  const twoCut = sceneExternalId === "sc_banggui_07";
  const key = twoCut
    ? `stories/banggui/scenes/${sceneExternalId}-${variant}.png`
    : `stories/banggui/scenes/${sceneExternalId}.png`;
  return assetUrl(key);
}

/** 대화 캐릭터 프로필 — characters.banggui.json external_id 기준 */
const CHARACTER_IMAGE_KEY: Record<string, string> = {
  ch_banggui_daughter_in_law: "stories/banggui/characters/myeoneuri.png",
  ch_banggui_father_in_law: "stories/banggui/characters/siabeoji.png",
  ch_banggui_village_chief: "stories/banggui/characters/ijang.png",
};

export function characterImageUrl(characterExternalId: string): string {
  const key = CHARACTER_IMAGE_KEY[characterExternalId];
  if (!key) throw new Error(`캐릭터 이미지 매핑 없음: ${characterExternalId}`);
  return assetUrl(key);
}

export function missionImageUrl(mission: 1 | 2): string {
  return assetUrl(`stories/banggui/missions/mission-${mission}.png`);
}

export function storyThumbnailUrl(titled = true): string {
  return assetUrl(`stories/banggui/${titled ? "thumbnail-titled" : "thumbnail"}.png`);
}

/** 아이 프로필 아바타 4종 + 보호자 — children.avatar_key 값으로 사용 (data-model §3-2) */
export type AvatarKey = "boy-1" | "boy-2" | "girl-1" | "girl-2";

export function avatarUrl(avatar: AvatarKey, variant: "avatar" | "select" | "select-bg" = "avatar"): string {
  return assetUrl(`profiles/${variant}/${avatar}.png`);
}

/** 추천 이야기 썸네일 6종 (홈 3×2 — '방귀 뀌는 며느리' 외 5종은 클릭 불가 더미) */
export function recommendedThumbnailUrls(): string[] {
  return storageAssets.assets
    .filter((a) => a.key.startsWith("recommended/"))
    .map((a) => `${BASE_URL}/${a.key}`);
}
