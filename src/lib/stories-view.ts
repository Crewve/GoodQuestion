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

/** 주제 필터 선택지 (2.2 — 단일 선택 Radio) */
export const TOPIC_FILTERS = ['전체', '다름', '용기', '친절', '나눔'] as const;

/** 난이도 필터 선택지 (2.2 — 단일 선택 Radio) */
export const DIFFICULTY_FILTERS = ['전체', '새싹 이야기', '튼튼 이야기', '도전 이야기'] as const;

/** 이야기 상세 고정 텍스트 (2.3 — 이야기 종류와 무관하게 동일 노출, 임시) */
export const LEARN_SECTION_TITLE = '이런 것을 배워요 📝';
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

/** 줄거리 = stories.summary + 고정 문구 한 문단 (2.3 줄거리 카드) */
export function summaryWithTagline(summary: string): string {
  return `${summary} ${SUMMARY_TAGLINE}`;
}
