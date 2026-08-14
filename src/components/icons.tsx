// 공용 아이콘 세트 (수정사항 C1 / QA 4·10) — 화면마다 흩어져 있던 이모지·중복 SVG를 한 곳으로 모은다.
//
// 왜 이모지를 쓰지 않는가: 이모지는 OS·브라우저마다 다른 컬러 폰트로 렌더돼(애플/구글/삼성) 시안과
// 색·형태가 어긋나고, 기기에 따라 아예 두부(□)로 나온다. 스토리보드의 아이콘은 전부 벡터라 SVG로 맞춘다.
//
// 출처 표기:
//   [피그마] = 「개발 배포용」 아이콘 컴포넌트의 패스를 원본에서 추출한 것 (좌표 그대로)
//   [시안 재현] = 스토리보드에 벡터가 없거나 이모지로 그려진 자리를 같은 톤으로 재현한 것
// 스타일 규칙: UI 글리프는 아웃라인(stroke=currentColor, strokeWidth 1.8) — 색은 부모의 text-* 상속.
//              메달·별처럼 색 자체가 의미인 것만 고정 컬러 채움.
type IconProps = { className?: string };

/* ── 아웃라인 글리프 ─────────────────────────────────────────── */

const OUTLINE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** 펼친 책 — 완료/배지/내정보 '다른 이야기 보기'·'읽은 책' 공통 [시안 재현] */
export function BookIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...OUTLINE}>
      <path d="M12 5.5C10.5 4.2 8.4 3.6 6 3.6c-1 0-2 .13-3 .4v14.5c1-.27 2-.4 3-.4 2.4 0 4.5.63 6 1.9 1.5-1.27 3.6-1.9 6-1.9 1 0 2 .13 3 .4V4c-1-.27-2-.4-3-.4-2.4 0-4.5.63-6 1.9v14.1" />
    </svg>
  );
}

/** 트로피 — 2.5 완료 '모은 배지 확인하기' [시안 재현] */
export function TrophyIcon({ className = 'size-7' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...OUTLINE}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21c1.18.54 2.03 2.03 2.03 3.79" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

/** 말풍선 — 내정보 활동 요약 '대화' [시안 재현] */
export function ChatBubbleIcon({ className = 'size-7' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...OUTLINE}>
      <path d="M12 3.5c-5 0-9 3.3-9 7.5 0 2.4 1.3 4.5 3.3 5.9l-.7 3.9 4-1.6c.8.2 1.6.3 2.4.3 5 0 9-3.4 9-7.5 0-4.2-4-7.5-9-7.5z" />
      <circle cx="8.5" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="11" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="11" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 시계 — 2.5 완료 '이야기 시간' (스토리보드 clock 벡터와 동일 형태) [시안 재현] */
export function ClockIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...OUTLINE}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5V12l4 2" />
    </svg>
  );
}

/** 자물쇠 — 회원가입·프로필 폼의 '개인정보 안내' [시안 재현] */
export function LockIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...OUTLINE}>
      <rect x="4" y="10.5" width="16" height="10.5" rx="3" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** 마이크(스탠드형) — 이용 가이드 '말하기' 타일 [시안 재현] */
export function MicStandIcon({ className = 'size-7' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...OUTLINE}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21" />
      <path d="M8.5 21h7" />
    </svg>
  );
}

/** 과녁 — 이용 가이드 '미션' 타일 [시안 재현] */
export function TargetIcon({ className = 'size-7' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...OUTLINE}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 메모 — 이용 가이드 '기록' 타일 [시안 재현] */
export function NoteIcon({ className = 'size-7' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...OUTLINE}>
      <path d="M6 3.5h9L19 8v12.5H6z" />
      <path d="M14.5 3.7V8.2H19" />
      <path d="M9 12.5h6M9 16h4" />
    </svg>
  );
}

/** 막대 그래프 — 이용 가이드 '리포트' 타일 [시안 재현] */
export function ChartIcon({ className = 'size-7' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...OUTLINE}>
      <path d="M4 20.5h16" />
      <path d="M7.5 20V13M12 20V6.5M16.5 20v-4.5" />
    </svg>
  );
}

/** 전구 — 이용 가이드 팁 줄머리 [시안 재현] */
export function BulbIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...OUTLINE}>
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.45 1 1.15 1 1.9v.7h5v-.7c0-.75.4-1.45 1-1.9A6 6 0 0 0 12 3Z" />
      <path d="M10 19.5h4" />
    </svg>
  );
}

/** 연필 — 2.4.5 '글로 쓰기' [시안 재현] */
export function PencilIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...OUTLINE}>
      <path d="M16.5 3.9a2.1 2.1 0 0 1 3 3L8.6 17.8l-4 1 1-4z" />
      <path d="M14.6 5.8l3.6 3.6" />
    </svg>
  );
}

/** 왼쪽 꺾쇠 — 뒤로가기 [피그마 CaretLeft, 텍스트 ‹ 대체(획이 얇아 시안과 다름)] */
export function ChevronLeftIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 4.5 7 12l7.5 7.5" />
    </svg>
  );
}

/** 오른쪽 꺾쇠 — 목록 행·'모두 보기' 진입 표시 (ChevronLeft 반전) */
export function ChevronRightIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 4.5 17 12l-7.5 7.5" />
    </svg>
  );
}

/** 오른쪽 화살표 — 버튼 뒤꼬리(→) [피그마 Icon 벡터, stroke 2.2] */
export function ArrowRightIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

/** 닫기(✕) — 팝업 닫기 버튼 [시안 재현] */
export function CloseIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden {...OUTLINE}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/* ── 채움 글리프 (피그마 원본 패스) ───────────────────────────── */

/** 재생 — 홈 '이어하기' 앞머리 [피그마 Play_fill] */
export function PlayIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M17.68 7.66 7.9 2.31C6.11 1.34 4 2.76 4 4.95v10.1c0 2.19 2.11 3.61 3.9 2.64l9.78-5.35c1.76-.96 1.76-3.72 0-4.68Z" />
    </svg>
  );
}

/** 사람 — 홈 헤더 프로필 버튼·아바타 미설정 자리 [피그마 User_alt_fill] */
export function UserIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
      <path d="M5.34 17.32C6 14.53 8.77 13 11.64 13h.72c2.87 0 5.64 1.53 6.3 4.32.13.54.23 1.11.29 1.68.05.55-.4 1-.95 1H6c-.55 0-1-.45-.95-1 .06-.57.16-1.14.29-1.68Z" />
    </svg>
  );
}

/** 펼친 책 + 책갈피 — 2.2 '이야기 모음' 헤더 글리프 [피그마 244:4451 원본 패스, 29.33×26] */
export function StoryBookIcon({ className = 'size-7' }: IconProps) {
  return (
    <svg viewBox="0 0 29.33 26" className={className} aria-hidden fill="currentColor">
      <path d="M14.67 26C13.6 25.16 12.44 24.5 11.2 24.03 9.96 23.57 8.67 23.33 7.33 23.33 6.4 23.33 5.48 23.46 4.58 23.7 3.68 23.94 2.82 24.29 2 24.73 1.53 24.98 1.08 24.97.65 24.7.22 24.43 0 24.04 0 23.53V7.47c0-.25.06-.48.18-.7.13-.23.31-.39.55-.5C1.76 5.73 2.82 5.33 3.93 5.07 5.04 4.8 6.18 4.67 7.33 4.67c1.29 0 2.55.16 3.79.5 1.23.33 2.41.83 3.55 1.5v16.13c1.13-.71 2.32-1.24 3.56-1.6 1.25-.36 2.5-.53 3.77-.53.8 0 1.58.06 2.35.2.77.13 1.54.33 2.32.6V5.47c.33.11.66.22.98.35.32.12.64.27.95.45.24.11.43.27.55.5.12.22.18.45.18.7v16.06c0 .51-.21.9-.65 1.17-.43.27-.88.28-1.35.03-.82-.44-1.68-.79-2.58-1.03-.9-.24-1.82-.37-2.75-.37-1.33 0-2.62.24-3.87.7-1.24.47-2.4 1.13-3.46 1.97ZM17.33 19.33V6.67L24 0v13.33l-6.67 6ZM12 21.5V8.3c-.73-.31-1.49-.55-2.28-.72C8.93 7.42 8.13 7.33 7.33 7.33c-.82 0-1.62.08-2.4.24-.77.15-1.53.39-2.26.7V21.5c.77-.29 1.55-.5 2.31-.63.77-.14 1.55-.2 2.35-.2.8 0 1.59.06 2.35.2.77.13 1.54.34 2.32.63Z" />
    </svg>
  );
}

/** 원형 플러스 — 2.1 '아이 추가' 카드 [피그마 PlusCircle, 70×70 원본 패스] */
export function PlusCircleIcon({ className = 'size-16' }: IconProps) {
  return (
    <svg viewBox="0 0 70 70" className={className} aria-hidden fill="currentColor">
      <path d="M35 6.56C29.37 6.56 23.88 8.23 19.2 11.35 14.52 14.48 10.88 18.92 8.72 24.11 6.57 29.31 6.01 35.03 7.11 40.55 8.2 46.06 10.91 51.13 14.89 55.11 18.87 59.08 23.93 61.79 29.45 62.89 34.97 63.99 40.68 63.42 45.88 61.27 51.08 59.12 55.52 55.47 58.64 50.8 61.77 46.12 63.44 40.62 63.44 35 63.43 27.46 60.43 20.23 55.1 14.9 49.77 9.57 42.54 6.57 35 6.56Zm0 52.5c-4.76 0-9.41-1.41-13.37-4.06-3.96-2.64-7.04-6.4-8.86-10.79-1.82-4.4-2.3-9.24-1.37-13.91.93-4.66 3.22-8.95 6.58-12.32 3.37-3.36 7.66-5.65 12.32-6.58 4.67-.93 9.51-.45 13.91 1.37 4.39 1.82 8.15 4.9 10.79 8.86 2.65 3.96 4.06 8.61 4.06 13.37-.01 6.38-2.54 12.49-7.06 17-4.51 4.52-10.62 7.05-17 7.06Z" />
      <path d="M48.12 35c0 .58-.23 1.13-.64 1.54-.41.41-.96.64-1.54.64h-8.75v8.76c0 .58-.24 1.13-.65 1.54-.41.41-.96.64-1.54.64-.58 0-1.14-.23-1.55-.64-.41-.41-.64-.96-.64-1.54v-8.76h-8.75c-.58 0-1.14-.23-1.55-.64-.41-.41-.64-.96-.64-1.54 0-.58.23-1.14.64-1.55.41-.41.97-.64 1.55-.64h8.75v-8.75c0-.58.23-1.14.64-1.55.41-.41.97-.64 1.55-.64.58 0 1.13.23 1.54.64.41.41.65.97.65 1.55v8.75h8.75c.58 0 1.13.23 1.54.64.41.41.64.97.64 1.55Z" />
    </svg>
  );
}

/** 체크 — 이야기 상세 '이런 것을 배워요' 줄머리 [피그마 check] */
export function CheckIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 13.33 10" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M0 5l5 5L13.33 0" />
    </svg>
  );
}

/** 원형 체크 — 카드 맞추기 정답 표시 [피그마 Check_ring] */
export function CheckRingIcon({ className = 'size-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

/* ── 컬러 고정 아이콘 ────────────────────────────────────────── */

/** 로제트 메달 — 배지 화면 완료 표시·미션 성공·내정보 배지 수 [시안 3.6 Gold Medal 벡터 재현]
    (원본은 얇은 #FFFF94 테두리까지 포함한 30여 개 패스라 아이콘 크기에서 뭉개짐 — 같은 배색으로 단순화) */
export function MedalIcon({ className = 'size-24' }: IconProps) {
  return (
    <svg viewBox="0 0 96 104" className={className} aria-hidden>
      <path d="M37 58 23 92l12-5 7 12 13-28z" fill="#CE4444" />
      <path d="M59 58l14 34-12-5-7 12-13-28z" fill="#983535" />
      <circle cx="48" cy="38" r="30" fill="#F7C325" />
      <circle cx="48" cy="38" r="23" fill="#EDB01B" />
      <path d="M48 24l5 10.1 11.2 1.6-8.1 7.9 1.9 11.1L48 49.5l-10 5.2 1.9-11.1-8.1-7.9 11.1-1.6z" fill="#FFF3C4" />
      <path d="M20 4l2.4 5.6L28 12l-5.6 2.4L20 20l-2.4-5.6L12 12l5.6-2.4z" fill="#FFF3C4" />
    </svg>
  );
}

/** 리본 메달(세로형) — 내정보 활동 요약 '모은 배지' [시안 재현, MedalIcon과 동일 배색] */
export function HangingMedalIcon({ className = 'size-7' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M8.2 1.5h3l2.3 8.2h-3z" fill="#CE4444" />
      <path d="M15.8 1.5h-3l-2.3 8.2h3z" fill="#983535" />
      <circle cx="12" cy="15.5" r="6.2" fill="#F7C325" />
      <circle cx="12" cy="15.5" r="4.7" fill="#EDB01B" />
      <path d="M12 12.4l1 2 2.2.3-1.6 1.6.4 2.2-2-1-2 1 .4-2.2-1.6-1.6 2.2-.3z" fill="#FFF3C4" />
    </svg>
  );
}

/** 별 — 미션 성공 화면의 역량 3종 (시안 ⭐ 자리) [시안 재현, Sunny #FFC93C] */
export function StarIcon({ className = 'size-7' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 2.5l2.9 5.9 6.6.9-4.8 4.6 1.2 6.5L12 17.3l-5.9 3.1 1.2-6.5L2.5 9.3l6.6-.9z"
        fill="#FFC93C"
        stroke="#F0A81E"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 반짝임 — 미션 성공 헤더 장식 (시안 ✨ 자리) [시안 재현] */
export function SparkleIcon({ className = 'size-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 1.5l1.9 6.6 6.6 1.9-6.6 1.9L12 18.5l-1.9-6.6L3.5 10l6.6-1.9z" />
      <path d="M19.5 15l.9 3 3 .9-3 .9-.9 3-.9-3-3-.9 3-.9z" opacity="0.7" />
    </svg>
  );
}

/** 축하 꽃가루 — 이야기 완주 안내 (시안 🎉 자리) [시안 재현] */
export function ConfettiIcon({ className = 'size-8' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M3 21l4.6-11.8 7.2 7.2z" fill="#FF7A3D" />
      <path d="M7.6 9.2l7.2 7.2-3.4 1.3-5.1-5.1z" fill="#F262A0" />
      <circle cx="18" cy="4.5" r="1.6" fill="#FFC93C" />
      <circle cx="21" cy="10" r="1.2" fill="#3DBE8B" />
      <circle cx="13.5" cy="3" r="1.2" fill="#4FA9E8" />
      <path d="M16.2 8.4l1 2.3 2.3 1-2.3 1-1 2.3-1-2.3-2.3-1 2.3-1z" fill="#FFC93C" />
    </svg>
  );
}
