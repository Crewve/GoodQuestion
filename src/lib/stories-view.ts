// T049 이야기 목록·상세 뷰 로직 (기능명세서 2.2·2.3) — 순수 함수.
// 이야기 수가 극소수(MVP 1편)라 필터는 DB 쿼리 대신 메모리에서 적용한다 — 전량 조회 후 여기서 판정.

export type StoryRow = {
  id: string;
  title: string;
  summary: string;
  difficulty: string;
  topics: string[] | null;
  estimated_minutes: number | null;
  status: string;
};

/** 미공개 추천 이야기 더미 7종 — 클릭 불가 표시 전용, 썸네일 assets.recommendedThumbnailUrls()와 순서 일치.
    주제·난이도·시간은 피그마 「개발 배포용」 2.0 Case B 카드 값 그대로 (프레임 간 값이 다른 경우 Case B 기준).
    홈(2.0)과 이야기 목록(2.2, PM 피드백 2026-08-16 "며느리 외 다른 이야기도 비활성 노출") 공용. */
export type DummyStory = {
  title: string;
  keywords: string[];
  difficulty: string;
  minutes: number;
};

export const DUMMY_STORIES: readonly DummyStory[] = [
  { title: '선녀와 나무꾼', keywords: ['다름'], difficulty: '새싹 이야기', minutes: 15 },
  { title: '해와 달이 된 오누이', keywords: ['친절', '용기'], difficulty: '도전 이야기', minutes: 18 },
  { title: '금도끼 은도끼', keywords: ['나눔', '다름'], difficulty: '튼튼 이야기', minutes: 16 },
  { title: '토끼와 거북이', keywords: ['다름', '용기'], difficulty: '새싹 이야기', minutes: 13 },
  { title: '혹부리 영감', keywords: ['다름', '용기'], difficulty: '도전 이야기', minutes: 20 },
  { title: '개미와 베짱이', keywords: ['나눔', '친절'], difficulty: '새싹 이야기', minutes: 10 },
  { title: '흥부와 놀부', keywords: ['나눔', '친절'], difficulty: '새싹 이야기', minutes: 16 },
];

/** 주제 필터 선택지 (2.2 — 단일 선택 Radio) */
export const TOPIC_FILTERS = ['전체', '다름', '용기', '친절', '나눔'] as const;

/** 난이도 필터 선택지 (2.2 — 단일 선택 Radio) */
export const DIFFICULTY_FILTERS = ['전체', '새싹 이야기', '튼튼 이야기', '도전 이야기'] as const;

/** 이야기 상세 고정 텍스트 (2.3 — 이야기 종류와 무관하게 동일 노출, 임시).
    이모지 없음 — 화면의 BookIcon과 겹쳐 책 아이콘이 두 개로 보였다 (QA 08/16, 이모지 쪽 삭제) */
export const LEARN_SECTION_TITLE = '이런 것을 배워요';
export const LEARN_POINTS = [
  '다름을 장점으로 바라보기',
  '상대방의 감정 이해하기',
  '문제 해결 방법 생각하기',
] as const;

const SUMMARY_TAGLINE = '이야기 속 캐릭터와 대화하며 나의 특별한 점을 찾아봐요!';

/** DB 난이도 값(쉬움/보통/어려움) → 표시 라벨. 이미 라벨이거나 미지의 값은 그대로 통과 */
export function difficultyLabel(raw: string): string {
  switch (raw) {
    case '쉬움':
      return '새싹 이야기';
    case '보통':
      return '튼튼 이야기';
    case '어려움':
      return '도전 이야기';
    default:
      return raw;
  }
}

/** 주제·난이도 단일 선택 AND 필터 (2.2) — published만 대상 */
export function filterStories(stories: StoryRow[], topic: string, level: string): StoryRow[] {
  return stories.filter((story) => {
    if (story.status !== 'published') return false;
    if (topic !== '전체' && !(story.topics ?? []).includes(topic)) return false;
    if (level !== '전체' && difficultyLabel(story.difficulty) !== level) return false;
    return true;
  });
}

/** 더미 이야기에도 동일한 주제·난이도 AND 필터 적용 (2.2 — 목록의 비활성 카드도 필터를 따른다).
    제네릭이라 썸네일 URL 등이 zip된 확장 객체도 그대로 통과한다. */
export function filterDummyStories<T extends Pick<DummyStory, 'keywords' | 'difficulty'>>(
  dummies: readonly T[],
  topic: string,
  level: string,
): T[] {
  return dummies.filter((dummy) => {
    if (topic !== '전체' && !dummy.keywords.includes(topic)) return false;
    if (level !== '전체' && difficultyLabel(dummy.difficulty) !== level) return false;
    return true;
  });
}

/** 줄거리 = stories.summary + 고정 문구 한 문단 (2.3 줄거리 카드) */
export function summaryWithTagline(summary: string): string {
  return `${summary} ${SUMMARY_TAGLINE}`;
}
