# HTTP API 계약 (Next.js Route Handlers)

모든 외부 API 키(OpenAI·타입캐스트·service role)는 이 계층 뒤에만 존재한다. 클라이언트는 아래 엔드포인트만 호출한다. 구현 착수 전 `node_modules/next/dist/docs/`의 Route Handler 문서 필독(AGENTS.md).

공통: 인증은 Supabase Auth 세션(쿠키) 기반. 오류 응답은 `{ error: { code, message } }`, 상태코드는 400(입력)/401(미인증)/502(외부 API 장애)/504(타임아웃).

## POST `/api/stt` — 음성 → 텍스트

| | |
|---|---|
| 요청 | `multipart/form-data`: `audio`(webm/opus 또는 audio/mp4, ≤30초), `sceneId`(uuid), `context`("dialogue" \| "mission" \| "retelling") |
| 처리 | 장면별 prompt 힌트 구성 → Whisper(`whisper-1`, verbose_json) → 실패 게이트 5종 → gpt-4o-mini 교정. **오디오는 응답 후 즉시 폐기(디스크·DB 미기록)** |
| 응답 200 | `SttResult` — `{ text, sttRawText, failed }` |
| 계약 | `failed: true`여도 200 (실패는 정상 분기). 서버는 이 호출에서 아무것도 저장하지 않는다 — 저장은 아이가 '보내기'를 눌러 `/api/turn` 호출 시에만 |

## POST `/api/turn` — 확정 텍스트 → 캐릭터 응답 (턴 1회)

| | |
|---|---|
| 요청 | `{ sessionId, sceneId, text, sttRawText, isMission?: boolean }` — '보내기' 클릭 시에만 호출 |
| 처리 | ① `messages` 저장(turn_order 증가) → ② 분석 LLM(4필드) → ③ 서버 후처리(인용 검증·중복·보정, raw 로그) → ④ `utterance_analyses` 저장 → ⑤ 규칙 엔진: 누적 갱신·미션 노출 판정·NORMAL/GUIDED/CLOSING → ⑥ CLOSING이면 LLM 미호출·고정 오디오 URL 반환, 아니면 캐릭터 LLM(GUIDED 시 부족 요소 1~2개만 유도)+후검증 → ⑦ TTS(캐시 히트 시 재합성 생략) → ⑧ `story_sessions` 상태 갱신 |
| 응답 200 | `{ mode: 'NORMAL'\|'GUIDED'\|'CLOSING', characterReplyText: string, audioUrl: string, exposeMission?: 'mission_1'\|'mission_2', missionPhase?: 'progress'\|'success', sceneEnd?: { reason: 'GOAL_MET'\|'MAX_TURNS', nextSceneId: string\|null }, progress: { accumulated: ThinkingElement[], missing: ThinkingElement[], turn: number, maxTurns: number } }` |
| 계약 | CLOSING 응답의 `audioUrl`은 `fixed-audio` 사전 생성 mp3 — LLM/TTS 장애와 무관하게 성공해야 한다. 캐릭터 응답 생성 실패 시 서버가 1회 자동 재시도 후 502. 미션 노출 판정은 이 응답의 `exposeMission`으로만 전달(클라이언트 판정 금지) |
| 미션 (T041) | **노출 턴**: `exposeMission`+`missionPhase:'progress'`, `characterReplyText:''`·`audioUrl:null` — 캐릭터 음성 없이 팝업만 표시(기능명세서 2.4.3), 캐릭터 메시지 미저장. **미션 응답 턴**(`isMission:true`): 저장·분석은 일반 턴과 동일 경로(요소 확인 활용, 정답 판정 아님), 응답에 `missionPhase:'success'` + 다음 캐릭터 대사 포함 — 클라이언트(T042)는 팝업 [성공 완료] 표시 후 닫힐 때 재생. 노출은 장면당 1회(`story_sessions.mission_phase`, 002 마이그레이션). 미션 미수행 상태의 GOAL_MET은 종료 보류(R-18), MAX_TURNS는 즉시 종료 |

## POST `/api/sessions` — 세션 시작/재개

| | |
|---|---|
| 요청 | `{ childId, storyId }` |
| 처리 | 진행 중 세션 조회 또는 생성. 재개 지점: `scene_goal_met=true` 최신 장면의 `scene_order+1`, 없으면 도입 완료 직후(scene_order=2), 도입 미완은 도입 1문장부터 |
| 응답 200 | `{ sessionId, childName, resumeSceneId, resumeSceneOrder, scenes: [{ id, order, type: '도입'\|'전개'\|'대화', description?, characterName?, openingText?, openingAudioUrl?, imageUrl }], progress: { n, N, percent } }` — 진행률 n/N은 전개+대화 쌍=1(도입 제외) 규칙 |
| R-07 | 자리표시자('ㅇㅇ') 오프닝의 `openingAudioUrl`은 실명 치환 런타임 TTS 합성본(캐시) 우선 — 시간 예산(3.5초) 내 미준비 시 '친구야' 사전 생성본 폴백. `openingText`(대화 장면 전용)는 서버가 고른 오디오와 표기를 항상 일치시킨 표시 텍스트 — 클라이언트는 이 값을 그대로 렌더한다(2026-08-11 확정) |

## POST `/api/post-activity` — 학습완료 활동

| | |
|---|---|
| 요청 (카드) | `{ sessionId, kind: 'card-order', submittedOrder: string[] }` — 슬롯 4개 모두 채워졌을 때만 |
| 처리 | `stories.post_activity_config.answer_order`와 서버 비교(프런트 판정 금지). `post_activity_results` upsert, `attempt_count` +1 |
| 응답 200 | `{ isOrderCorrect: boolean, attemptCount: number }` |
| 요청 (재구성) | `{ sessionId, kind: 'retelling', retellingText: string }` |
| 처리 | `retelling_text`·`completed_at` 저장, 세션 완료 처리(이어하기 제외) |
| 응답 200 | `{ completed: true }` |

## 화면 데이터 조회 (Server Component 직접 조회로 대체 가능)

목록/상세/홈/마이페이지의 읽기 데이터(stories 필터, 이어하기 카드, 프로필 목록)는 별도 API 없이 Server Component에서 Supabase 조회를 기본으로 한다. 클라이언트 상호작용이 필요한 쓰기(프로필 등록 등)는 Server Action 또는 `/api/profiles`로 통일 — 조립 단계(tasks)에서 확정.

## 폴백 매트릭스

| 장애 | 동작 |
|---|---|
| Whisper 실패/타임아웃 | `failed: true` 응답 → "다시 한번 말해줄래?" 재시도 (메시지 미생성) |
| 분석/생성 LLM 장애 | 1회 재시도 → 실패 시 고정 대사 폴백(시스템 안내 또는 클로징 조기 전환) — 리허설 체크 항목 |
| TTS 장애 | 캐시 조회 → 미스 시 텍스트만 표시(내레이션은 "다시 듣기" 재시도), CLOSING은 영향 없음(사전 생성) |
| max_turns 직전 응답 지연 | 타임아웃 후 최대 턴 종료 로직 강제 적용(무한 대기 방지) |
