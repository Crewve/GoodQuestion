// 단어장 콘텐츠 접근 레이어 (2.6) — fixtures/wordbook.banggui.json이 SoT.
// 팀 결정(2026-08-15): DB 설계서 12. wordbook(아이가 저장한 단어 모델)과 달리 MVP 단어장은
// 이야기별 고정 콘텐츠(단어 5종 + 퀴즈 5문항)라 DB 없이 fixture로 관리한다 — 스키마 변경 없음.
// 이미지: 단어는 storage wordbook/ 키, 퀴즈는 이야기 장면 재사용(sceneImageUrl 규약 — 대화3만 2컷).
import wordbookFixture from '../../fixtures/wordbook.banggui.json';
import { assetUrl, sceneImageUrl } from './assets';
import { externalIdToUuid } from './external-id';

export type WordbookWord = {
  external_id: string;
  word: string;
  definition: string;
  /** "(이야기 속에 나왔던 말)" 원문 인용 */
  story_quote: string;
  image_key: string;
};

export type WordbookQuizItem = {
  external_id: string;
  scene_external_id: string;
  /** 대화3(sc_banggui_07)만 2컷 — 그 외 장면은 생략(1컷) */
  scene_variant?: number;
  /** 빈칸(□) 포함 문제 문장 — 전달 자료 원문 */
  question: string;
  choices: string[];
  answer_index: number;
  explanation: string;
};

const fixture = wordbookFixture as {
  story_external_id: string;
  words: WordbookWord[];
  quiz: WordbookQuizItem[];
};

/** 단어장이 속한 이야기 uuid — BANGGUI_STORY_ID와 동일 (story.ts 규약 재사용) */
export const WORDBOOK_STORY_ID = externalIdToUuid(fixture.story_external_id);

export function wordbookWords(): WordbookWord[] {
  return fixture.words;
}

export function wordbookQuiz(): WordbookQuizItem[] {
  return fixture.quiz;
}

export function wordImageUrl(word: WordbookWord): string {
  return assetUrl(word.image_key);
}

export function quizSceneImageUrl(item: WordbookQuizItem): string {
  return sceneImageUrl(item.scene_external_id, item.scene_variant === 2 ? 2 : 1);
}

/** 소리내어 듣기(단어+뜻) 사전 생성 오디오 키 — fixtures/tts-lines.banggui.json kind=wordbook과 1:1 */
export function wordAudioKey(word: WordbookWord): string {
  return `wordbook__${word.external_id}`;
}

/** 힌트 듣기(정답을 채운 원문 문장) 사전 생성 오디오 키 */
export function quizHintAudioKey(item: WordbookQuizItem): string {
  return `wordbook__${item.external_id}_hint`;
}

/** 문제 빈칸 표시 — 원문 '□'(음절 수만큼)를 시안 표기('_')로 치환 */
export function quizQuestionDisplay(item: WordbookQuizItem): string {
  return item.question.replaceAll('□', '_');
}
