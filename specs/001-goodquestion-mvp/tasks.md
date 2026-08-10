# Tasks: 굿퀘스천 MVP — 아동 음성대화 학습 서비스

**Input**: Design documents from `/specs/001-goodquestion-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (모두 존재)

**Tests**: 문서 요구에 따라 포함 — 규칙 엔진·STT 게이트는 순수 함수 Vitest, 각 파트는 CLI 단독 검증(분담 원칙·R-13). 그 외 화면은 quickstart 시나리오로 검증.

**Organization**: 유저 스토리별 독립 구현·검증 + **모든 Phase를 2인 분담 트랙으로 분할**. 태스크 설명 앞의 `(파트1)`/`(파트2)`/`(공동)`이 담당 표기다.

## 2인 분담 원칙

| 트랙 | 영역 | 소유 파일 |
|---|---|---|
| **파트1** (음성 I/O) | STT·TTS 어댑터, 오디오 자산·재생/녹음 UI, 에셋·정적 화면 | `src/lib/stt/`·`src/lib/tts/`·`src/hooks/`·오디오 스크립트, 담당 화면 파일 |
| **파트2** (대화 두뇌) | 분석·규칙·생성 LLM, DB·세션·API 오케스트레이션, 폼/데이터 화면 | `src/lib/llm/`·`src/lib/rules/`·`src/app/api/`·시드, 담당 화면 파일 |
| **공동** | 계약 합의·최종 배선·리허설 4건만 | `src/lib/contracts.ts`·`fixtures/` (변경은 상호 합의) |

- 같은 파일을 두 사람이 수정하는 태스크는 없다 — 접점은 `contracts.ts` 타입과 `/api/turn`의 lib 호출뿐.
- 배분: **파트1 30개 · 파트2 31개 · 공동 4개** (총 65개). Phase별 병렬 진행 가능하도록 각 Phase 안에서 트랙을 나눴다.
- 실제 담당자 매핑은 팀 결정(파트1 계획 §5 기준: 나=파트1, 팀원=파트2 — 분담안 문서 표기와 반대이므로 시작 전 재확인).

**공통 주의**: Next.js 관련 파일을 처음 만들기 전에 반드시 `node_modules/next/dist/docs/`의 해당 문서를 읽을 것(AGENTS.md — 관례가 학습 데이터와 다름). 콘텐츠 하드코딩 금지(fixtures→시드).

## Format: `[ID] [P?] [Story] (담당) Description`

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 의존성·환경변수·클라이언트·계약 타입 등 공유 기반

### 파트1 트랙

- [X] T001 (파트1) 의존성 추가: `openai @supabase/supabase-js @supabase/ssr zustand` + dev `tsx vitest` — package.json (npm install; 이후 양 트랙 pull) ※ Node 20 호환용 `ws`·`@types/ws` 추가 (supabase-js v2.109+가 Node 22 네이티브 WebSocket 요구 — scripts/lib/supabase.ts 참고, 파트2 T004의 src/lib/supabase.ts도 동일 조치 필요)
- [X] T002 [P] (파트1) `.env.example` 작성(OPENAI_API_KEY·TYPECAST_API_KEY·NEXT_PUBLIC_SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY·모델 오버라이드 3종) + `.env.local` 실키 보강 — 타입캐스트 가입·키 발급 포함 (quickstart §0) ※ OPENAI_API_KEY·TYPECAST_API_KEY 실값 입력은 사람 작업으로 남음 (.gitignore에 !.env.example 예외 추가)
- [X] T006 [P] (파트1) Storage 버킷 생성 스크립트 `scripts/setup-buckets.ts` — `fixed-audio`·`tts-cache` 공개 읽기 버킷 생성(멱등), 실행 ✓ 2회 실행으로 멱등 확인, 공용 헬퍼 scripts/lib/{env,supabase}.ts 동봉

### 파트2 트랙

- [ ] T003 [P] (파트2) 설정 로더 `src/lib/config.ts` — 역할별 모델명(기본 gpt-4o-mini)·STT 게이트 임계값(no_speech_prob 0.6, avg_logprob -1.0 등)을 env/상수로 분리 (R-02; 임계 기본값은 파트1과 항목 합의)
- [ ] T004 [P] (파트2) OpenAI 단일 클라이언트 `src/lib/openai.ts` + 서버 전용 Supabase service role 클라이언트 `src/lib/supabase.ts` (`server-only` 임포트로 클라이언트 번들 유입 차단)

### 공동 (Day 0 합의 — 30분 타임박스)

- [X] T005 (공동) 공유 계약 타입 `src/lib/contracts.ts` — contracts/lib-contracts.md 초안을 파트2가 작성, 파트1 승인으로 확정 (ThinkingElement 8종·SttResult·AnalysisResult·ProgressDecision). 이후 변경은 상호 합의로만 ✓ 파트2 초안(382c28b) 검토 결과 계약 문서와 일치 — 파트1 승인 완료 (2026-08-10)

**🔗 동기화 포인트 #1**: T005 합의 완료 = 양 트랙 완전 병렬 시작 가능

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 의존하는 DB 데이터·레이아웃·인증 기반

**⚠️ CRITICAL**: 이 단계 완료 전에는 유저 스토리 착수 불가 (단, 트랙별로 자기 담당분만 끝나면 자기 스토리 트랙 착수 가능)

### 파트1 트랙

- [X] T009 [P] (파트1) 루트 레이아웃·디자인 토큰 — `src/app/layout.tsx`에 `next/font/local`(src/fonts의 Cafe24Ssurround+PretendardGOV 4웨이트), `src/app/globals.css`에 컬러 토큰 7종(Base #FFF8EE·Primary #FF7A3D 등) (R-14; next 폰트 문서 선독) ✓ Tailwind v4 @theme inline 연결(font-sans/font-display, bg-primary 등), lang=ko, 라이트 고정, next build 통과
- [X] T011 [P] (파트1) 에셋 URL 헬퍼 `src/lib/assets.ts` — `fixtures/storage-assets.json`의 base_url+key 조합, 장면 external_id→이미지 URL 매핑 ✓ 장면(대화3 2컷)·캐릭터·미션·아바타·추천 썸네일 헬퍼, 미등록 키 즉시 throw

### 파트2 트랙

- [ ] T007 (파트2) 스키마 갭 마이그레이션 `supabase/migrations/001_mvp_additions.sql` — `story_scenes.scene_type`('도입'/'전개'/'대화'), `children.avatar_key`·`birth_date` 추가 (data-model §3 — Notion SoT라 팀 공유 후 적용, R-11)
- [ ] T008 (파트2) 시드 스크립트 `scripts/seed.ts` — `fixtures/story.banggui.json` → stories/story_scenes upsert(external_id→uuid 매핑 보존, 임시 채택값 R-08: 대화2 요소=장면 테이블, EXPRESSION→REASON, preferred_turns=max_turns), 실행·검증 (T007 의존)
- [ ] T010 [P] (파트2) Supabase Auth 연동 기반 — `src/lib/supabase-browser.ts`·`src/middleware.ts`(@supabase/ssr 세션 갱신·보호 라우트) (R-10)

**Checkpoint**: DB에 이야기 1편 시드 완료·폰트/토큰 적용·인증 미들웨어 동작

---

## Phase 3: User Story 1 - 이야기 진행: 음성 대화 턴 사이클 (Priority: P1) 🎯 MVP

**Goal**: 도입·전개 내레이션 재생과 대화 장면의 완전한 턴 루프(녹음→STT 게이트→분석→규칙→생성/고정 대사→TTS→재생). CLOSING은 사전 생성 오디오.

**Independent Test**: UI 없이 `stt-check`/`tts-check`/`simulate` CLI로 왕복 검증(quickstart §1·§2) → 화면 조립 후 대화1 장면 E2E(quickstart §4-2~5).

**분담 구조**: 코어(T012~T029)는 두 트랙이 서로를 전혀 기다리지 않는다. API 조립에서 파트1 lib를 파트2가 호출하며 합류하고, UI도 화면 파일 단위로 나눈다.

### 파트1 트랙 — 음성 I/O 코어 (CLI 단독 검증)

- [X] T012 [P] [US1] (파트1) STT 실패 게이트 순수 함수 `src/lib/stt/gates.ts` — 5종 순서(1~2자→no_speech_prob→avg_logprob→n-gram 반복→자막체 상투구), 임계값은 config 주입 (R-02) ✓ 구간 길이 가중 평균, 상투구는 공백 무시 비교, 신호 수집 함수 분리(collectSignals — stt-check 튜닝 출력용)
- [X] T013 [P] [US1] (파트1) 게이트 단위 테스트 `src/lib/stt/gates.test.ts` — 무음·환각·정상 케이스 (Vitest) ✓ 10케이스 통과 (게이트 5종·순서 우선·가중 평균·설정 주입, config.ts 기본값 정합 포함)
- [X] T014 [P] [US1] (파트1) 장면별 prompt 힌트 빌더 `src/lib/stt/hints.ts` — fixtures 캐릭터명·핵심 단어, ≤224토큰 ✓ 직전 캐릭터 대사(GUIDED 질문) 우선 주입, Whisper가 prompt 끝부분을 쓰는 특성 반영해 핵심 어휘 후치·앞에서 절단
- [ ] T015 [US1] (파트1) Whisper 어댑터+경량 교정 `src/lib/stt/index.ts` — verbose_json, 게이트 통과 후 gpt-4o-mini 교정(맞춤법·조사만, 실패 시 sttRawText 폴백), `SttResult` 반환, 오디오 즉시 폐기 (T012·T014 의존)
- [X] T016 [P] [US1] (파트1) 타입캐스트 어댑터 `src/lib/tts/typecast.ts` — `synthesize(text, voiceId)→mp3 Buffer`, provider 인터페이스, 동시성 2 제한 큐 내장 (R-05; 가입·API 스펙 확인 선행) ✓ API 실측 확정: GET /v1/voices·POST /v1/text-to-speech(X-API-KEY, mp3 320kbps), model은 보이스별 자동 해석
- [X] T017 [US1] (파트1) TTS 2층 캐시 `src/lib/tts/cache.ts` + 진입점 `src/lib/tts/index.ts` — `hash(voiceId+text)`, 로컬 디렉토리(CLI)+`tts-cache` 버킷(런타임) (T016 의존) ✓ 로컬 히트 49ms·Storage write-through·공개 URL 200 검증. Storage 클라이언트는 주입 방식(파트2 supabase.ts Node20 이슈와 분리)
- [X] T018 [P] [US1] (파트1) 보이스 후보 스크립트 `scripts/tts-voices.ts` — 역할 4종×후보 2~3개 샘플 mp3 생성, 즉시 실행해 팀 투표 요청 (**크리티컬 패스 — Day 0 최우선, 투표 리드타임**) ✓ 12건 생성(414자 사용, out/voice-samples/) — **팀 투표 대기 중, 확정 시 T019 진행**
- [ ] T019 [US1] (파트1) 보이스 매핑 확정 `src/lib/tts/voice-map.json` — 투표 결과로 며느리·시아버지·마을 이장·내레이터 voice_id 기록 (T018 투표 의존)
- [ ] T020 [P] [US1] (파트1) 왕복 검증 CLI `scripts/stt-check.ts`·`scripts/tts-check.ts` — SttResult+게이트 신호 전부 출력 / 텍스트→mp3 저장·캐시 히트 확인 ※ tts-check 완료(--storage 옵션 포함, 캐시 HIT·URL 검증) — stt-check는 OPENAI_API_KEY 입력 + T015 이후
- [ ] T021 [US1] (파트1) 사전 생성 스크립트 `scripts/pregenerate-audio.ts` — tts-lines 14건→mp3→`fixed-audio` 업로드(파일명 `{key}.mp3` 잠정 R-06, 'ㅇㅇ' 2건 '친구야' 치환 R-07, 멱등), 실행 (T019 의존)
- [ ] T022 [US1] (파트1) 게이트 임계 1차 튜닝 — 직접 녹음한 아동 발화 근사 샘플 10~20건(iPad audio/mp4·안드로이드 webm/opus 각각)으로 `stt-check` 실측, config 기본값 갱신 (T015·T020 의존)

**🔗 동기화 포인트 #2**: T022 완료 = 파트2에 "`SttResult` 인터페이스 전달 완료" 선언 (파트1 계획 §4-8)

### 파트2 트랙 — 대화 두뇌 코어 (CLI 단독 검증, 파트1과 동시 진행)

- [ ] T023 [P] [US1] (파트2) 규칙 엔진 순수 함수 `src/lib/rules/engine.ts` — accumulated/missing 계산, turns_without_new_element·consecutive_low_information_turns 카운트, NORMAL/GUIDED(유도 1~2개)/CLOSING 판정, 종료 이유 GOAL_MET/MAX_TURNS (FR-010; LLM 무관·문장 미생성)
- [ ] T024 [P] [US1] (파트2) 규칙 엔진 테스트 `src/lib/rules/engine.test.ts` — 누적 유지·모드 전환·최대 턴·조기 종료 케이스 (Vitest)
- [ ] T025 [P] [US1] (파트2) 분석 LLM `src/lib/llm/analysis.ts` — 4필드 구조화 출력(child_intent/main_point/detected_elements/utterance_validity), 탐지는 항상 8요소 전체 명문화 (R-03)
- [ ] T026 [P] [US1] (파트2) 서버 후처리 `src/lib/llm/postprocess.ts` — evidence 원문 인용 검증·중복 정리·약한 탐지 보정, LLM 원본은 서버 로그로 보존(R-11-4)
- [ ] T027 [P] [US1] (파트2) 캐릭터 생성 LLM `src/lib/llm/generate.ts` — fixtures/characters 페르소나 시스템 프롬프트, GUIDED 시 서버 지정 부족 요소만 유도, 아동 안전 가드레일+후검증(길이·금칙어) (FR-011)
- [ ] T028 [P] [US1] (파트2) eval 골든 세트 `eval/cases.json`(모의 아동 발화 20~30건 요소 라벨) + 회귀 러너 `eval/run.ts`
- [ ] T029 [US1] (파트2) 시뮬레이션 CLI `scripts/simulate.ts` — 대본 입력→분석→후처리→판정→응답 루프 텍스트 출력 (T023·T025~T027 의존, 데모 폴백 겸용 R-17)

### API 조립 (트랙별 소유 — Route Handler 착수 전 Next 16.3 문서 필독)

- [ ] T030 [US1] (파트1) `src/app/api/stt/route.ts` — multipart 수신→힌트→Whisper→게이트→교정→`SttResult` 200, 무저장·즉시 폐기 (contracts/api-routes.md; T015 의존. api/ 중 이 파일만 파트1 소유)
- [ ] T031 [US1] (파트2) `src/app/api/sessions/route.ts` — 세션 시작/재개 지점 계산(scene_goal_met 기준, 도입은 항상 처음), scenes 페이로드(scene_type·이미지 URL·고정 오디오 URL)·진행률 n/N(전개+대화 쌍=1) (T007·T008 의존; 이미지 URL은 파트1의 T011 헬퍼 호출)
- [ ] T032 [US1] (파트2) `src/app/api/turn/route.ts` — 오케스트레이션 ①메시지 저장→②분석→③후처리→④utterance_analyses 저장→⑤규칙→⑥생성 또는 고정 대사→⑦TTS 캐시→⑧세션 갱신, 실패 시 1회 재시도·폴백 (파트1 lib는 `@/lib/tts` 인터페이스로만 호출 — T017·T021 산출물 의존, 코드 접점 없음)

### UI 조립 (화면 파일 단위 분담)

- [ ] T033 [P] [US1] (파트2) 턴 상태머신 `src/store/turn.ts` — CHAR_SPEAKING→RECORDING→TRANSCRIBING→REVIEW→SUBMITTED 전이, 게이트 실패 시 RECORDING 복귀 (data-model §5)
- [ ] T034 [P] [US1] (파트1) 오디오 훅 `src/hooks/useAudioUnlock.ts`·`src/hooks/useRecorder.ts` — 첫 제스처 언락(iPad), MediaRecorder(mp4/webm), RMS·최소 길이 사전 게이트, 30초 자동 종료 (R-15)
- [ ] T035 [P] [US1] (파트1) 진행 공통 컴포넌트 `src/components/progress-header.tsx` — 진행률 텍스트·바(도입 n=1 고정)·X 나가기(상세 복귀)
- [ ] T036 [US1] (파트1) 이야기 진행 컨테이너+도입/전개 화면 `src/app/play/[sessionId]/page.tsx`·`src/components/narration-scene.tsx` — scene_description 온점 분리 문장 자동 재생, 이전/다음 화살표(첫/끝 규칙)·다시 듣기·마지막 문장 진행하기 (T031 응답 스키마 의존 — contracts/api-routes.md 기준으로 병렬 개발 가능)
- [ ] T037 [US1] (파트2) 대화 화면 `src/components/dialogue-scene.tsx` — 캐릭터 대사 카드(이름·이미지·자동 재생)·상태 배지 3종·대화 내역 리스트·마이크/보내기 버튼·STT 미리보기(수정 불가) (T033 의존, 파트1의 T034 훅 임포트)
- [ ] T038 [US1] (공동) 턴 사이클 배선 — 캐릭터 오디오 종료→마이크 자동 시작, 보내기→`/api/turn`→응답 재생, CLOSING→고정 오디오 재생 후 다음 장면 전환(대화 마지막이면 학습완료로) (T030·T032·T036·T037 의존 — 페어로 진행, 통합 이슈 즉석 해결)

**🔗 동기화 포인트 #3**: T038 = 양 트랙 합류. quickstart §1·§2 CLI 전항 + §3 API 스모크 + 대화1 E2E — **여기까지가 데모 가능한 MVP**

---

## Phase 4: User Story 2 - 미션 노출과 수행 (Priority: P2)

**Goal**: 대화3(미션1)·대화4(미션2)에서 노출 조건 충족 시 오버레이 팝업 미션, 음성 응답, 결과의 대화 반영.

**Independent Test**: `simulate`에 미션 시나리오 대본 4종(노출 조건별) → 노출 판정·반영 확인, 화면에서 대화3 E2E(quickstart §4-4).

**분담 구조**: 판정·API는 파트2, 팝업 UI는 파트1 — US3(파트1 화면 다수)과 동시 진행 시 파트1 부하를 고려해 팝업만 배정.

### 파트1 트랙

- [ ] T042 [P] [US2] (파트1) 미션 오버레이 팝업 `src/components/mission-popup.tsx` — 화면 전환 없는 단일 오버레이, [진행 중]→[성공 완료] 내부 전환, 마이크는 버튼 시작(자동 아님, T034 훅 재사용), 이야기 계속하기로 복귀 (T037 의존)

### 파트2 트랙

- [ ] T039 [P] [US2] (파트2) 미션 설정 로더 `src/lib/missions.ts` — fixtures `missions` 키(goal·guide_points·expose_conditions·examples) 로드, 장면 매핑(sc_banggui_07/09) (R-11-3)
- [ ] T040 [US2] (파트2) 미션 노출 판정 `src/lib/rules/mission.ts` + `src/lib/rules/mission.test.ts` — expose_conditions 4종을 분석 결과·턴 수 기반 순수 함수로 판정, 노출은 장면당 1회 (T039 의존; 미션 결과는 요소 확인에 활용 — 정답 판정 아님)
- [ ] T041 [US2] (파트2) `/api/turn` 미션 분기 확장 — `isMission` 입력 처리(미션 응답도 메시지·분석 동일 경로), 응답에 `exposeMission`·`missionPhase` 포함, 미션 완료를 CLOSING 조건 ③에 반영 (T032·T040 의존)
- [ ] T043 [US2] (파트2) 미션 시나리오 검증 — `scripts/scenarios/mission-*.json` 대본 4종 작성, `simulate` 실행·eval 케이스 추가 (T029·T040 의존)

**Checkpoint**: US1 + 미션 포함 대화3·대화4 전체 흐름 동작

---

## Phase 5: User Story 3 - 진입 여정: 로그인→프로필→홈→이야기 선택 (Priority: P2)

**Goal**: 보호자 가입·아이 프로필(1~3명)·홈(이어하기/추천)·목록(필터)·상세→시작하기.

**Independent Test**: 회원가입→프로필 등록→홈→상세→시작하기 클릭 경로 E2E(quickstart §4-1~2), 이어하기 재개 지점 확인.

**분담 구조**: 화면 파일 단위로 3(파트1) : 4(파트2). 파트1은 카드·선택 UI, 파트2는 폼 검증·DB 연동이 무거운 화면.

### 파트1 트랙

- [ ] T044 [P] [US3] (파트1) 로그인 화면 `src/app/(auth)/login/page.tsx` — 이메일/소셜 탭 전환, Supabase Auth signIn, 에러 문구 3종(기능명세서 1.1), 성공 시 프로필 선택 이동 (소셜은 카카오 1개 — 심사 지연 시 구글 대체 R-10)
- [ ] T047 [P] [US3] (파트1) 아이 프로필 선택·추가 화면 `src/app/profiles/page.tsx` — 카드 최대 3+추가 카드(3명 시 숨김), 만 나이 배지 계산, 선택 시 홈 진입(아이 컨텍스트), 2.1.1 추가 폼 재사용
- [ ] T048 [P] [US3] (파트1) 홈 화면 `src/app/home/page.tsx` — 인사말(성 제외 이름), 이어하기 카드(진행률 n/N·%·계속하기) 조건 노출, 추천 3×2 6개(첫 카드 '방귀 뀌는 며느리' 고정·유일 클릭 가능), GNB(단어장 이동 없음) (진행률은 T031 응답 재사용)

### 파트2 트랙

- [ ] T045 [P] [US3] (파트2) 회원가입 2단계 화면 `src/app/(auth)/signup/page.tsx` — 순차 인디케이터, 1단계 계정 생성(이메일 중복·비번 8~20 규칙·약관 전체동의; SMS 인증은 미구현 범위 축소 R-10), 2단계 아이 탭 1~3명(캐릭터 4종·이름·생년월일 YYYYMMDD·아동 동의 1회), 검증 시점 규칙(탭별/전체) (T010 의존)
- [ ] T046 [US3] (파트2) 프로필 저장 처리 — Server Action 또는 `src/app/api/profiles/route.ts`: parents/children(avatar_key·birth_date)/child_consents 기록 (T007 의존; T045·T047 폼이 공용 호출)
- [ ] T049 [P] [US3] (파트2) 이야기 목록·상세 `src/app/stories/page.tsx`·`src/app/stories/[storyId]/page.tsx` — 주제·난이도 단일 선택 AND 필터·빈 상태, 상세(stories 데이터+고정 문구 '이런 것을 배워요')·시작하기 (Server Component 직접 조회)
- [ ] T050 [US3] (파트2) 시작하기→세션 연결 — `/api/sessions` 호출, 진행 이력 유무별 재개/신규 라우팅(`/play/[sessionId]`) (T031·T049 의존)

**Checkpoint**: 가입부터 이야기 시작까지 전체 여정 + US1 대화 진입

---

## Phase 6: User Story 4 - 학습 완료 후속 활동 (Priority: P3)

**Goal**: 카드 순서 배열(서버 판정·재시도)→핵심 단어 재구성 발화→학습 완료 화면·세션 완료 처리.

**Independent Test**: 카드 오답→정답→재구성→완료 화면→이어하기 제외 (quickstart §4-6), 재진입 라우팅 3분기 확인.

**분담 구조**: 인터랙션 화면 2개(파트1) : 콘텐츠·API·완료 처리(파트2).

### 파트1 트랙

- [ ] T053 [P] [US4] (파트1) 카드 배열 화면 `src/components/card-ordering.tsx` — 4장 무작위 제시·슬롯 1~4 드래그앤드롭+Tap-to-Move(FR-020), 4칸 채움 시 제출, 오답 시 배치 유지·재제출, 정답 버튼 노출
- [ ] T054 [P] [US4] (파트1) 재구성 발화 화면 `src/components/retelling.tsx` — 카드 4컷+핵심 단어 표시, 마이크 버튼 시작 녹음·STT 결과 표시·보내기 (T034 useRecorder 재사용)

### 파트2 트랙

- [ ] T051 [US4] (파트2) 임시 post_activity_config 저작 — 장면 이미지 4장+정답 순서+핵심 단어 4개를 `fixtures/story.banggui.json`에 추가(스키마 R-09, fixtures 변경이므로 파트1에 공유), `scripts/seed.ts` 재실행 반영 (기획 회신 시 데이터만 교체)
- [ ] T052 [US4] (파트2) `src/app/api/post-activity/route.ts` — card-order 서버 판정(프런트 판정 금지)·attempt_count 증가 upsert, retelling 저장·completed_at·세션 완료 처리 (contracts/api-routes.md; T051 의존)
- [ ] T055 [US4] (파트2) 학습 완료 화면 `src/app/complete/[sessionId]/page.tsx` — 완료 안내·오늘의 이야기·배지 카드·이동 버튼 2종, 완료 이야기 이어하기 제외 확인 + 재진입 라우팅(completed_at/is_order_correct 분기) (T052 의존)

**Checkpoint**: 이야기 시작→학습 완료까지 풀 코스 동작

---

## Phase 7: User Story 5 - 마이페이지·시스템 메뉴 (Priority: P3)

**Goal**: 내정보·프로필 관리·공지/고객센터/이용안내·배지(정적)·로그아웃.

**Independent Test**: 각 메뉴 진입·표시·이동 경로, 로그아웃 확인 팝업→로그인 화면.

**분담 구조**: 화면 2 : 2 — 전부 [P], 남는 쪽이 가져가도 무방한 저위험 정적 화면.

### 파트1 트랙

- [ ] T056 [P] [US5] (파트1) 내정보 `src/app/my/page.tsx` — 로그인 방식 문구, 아이 프로필 리스트(표시 전용), 주간 요약 카드 3종, 메뉴 버튼, 로그아웃 확인 팝업 (기능명세서 3.1)
- [ ] T058 [P] [US5] (파트1) 공지사항·고객센터·이용안내 `src/app/my/notices/page.tsx`·`src/app/my/support/page.tsx`·`src/app/my/guide/page.tsx` — 목록/아코디언 정적 콘텐츠+빈 상태 문구

### 파트2 트랙

- [ ] T057 [P] [US5] (파트2) 프로필 관리 `src/app/my/profiles/page.tsx` — 목록+아이 추가(2.1.1 폼 재사용, 3명 제한)
- [ ] T059 [P] [US5] (파트2) 배지 화면 `src/app/my/badges/page.tsx` — 피그마 원안 정적 UI(미션 단계·진행바 3/7·동화 카드 8종, 데이터 연동 없음)

**Checkpoint**: 전 화면 내비게이션 완결

---

## Phase 8: Polish & Cross-Cutting Concerns

**분담 구조**: 파트1=오디오·UI 의무 사항, 파트2=보안·문서, 리허설 2건은 공동.

### 파트1 트랙

- [ ] T061 [P] (파트1) 타입캐스트 출처 표기 노출 — 시연 화면 공통 푸터/크레딧 `src/components/attribution.tsx` (무료 플랜 의무 — 잊기 쉬움, FR-013)
- [ ] T062 [P] (파트1) UI 가이드 점검 — 아이 화면 최소 18px·터치 48px·대비 4.5:1·색+아이콘+텍스트 병행·스크롤 미허용, 보호자 Header/GNB 고정 (핸드오프 가이드 전 조항)

### 파트2 트랙

- [ ] T063 [P] (파트2) 보안·프라이버시 확인 — `next build` 후 클라이언트 번들 키 3종 검색, 원본 음성 미저장(임시 파일 포함) 확인 (quickstart §5)
- [ ] T065 [P] (파트2) 문서 갱신 — `docs/프로젝트/프로젝트_디렉토리_명세.md` §3을 실제 구조로 갱신, research.md 미해결 7건 회신 결과 반영

### 공동 (통합 리허설)

- [ ] T060 (공동) 장애 폴백 리허설 — TTS 키 제거 상태 CLOSING 재생, LLM 장애 1회 재시도·고정 대사 폴백, max_turns 직전 타임아웃 강제 종료 (contracts/api-routes.md 폴백 매트릭스 전항)
- [ ] T064 (공동) quickstart.md 전체 검증 실행 — §1~§4 E2E 데모 시나리오 리허설, 타입캐스트 사용량·무료 한도 재확인 (T060 이후 마지막)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)** → **Foundational (P2)** → 유저 스토리들 → **Polish**
- 트랙 단위 완화: 파트1은 T009·T011만 끝나면 US1 파트1 트랙 착수 가능, 파트2는 T007·T008·T010 완료 후 US1 파트2 트랙 착수 — 상대 트랙의 Foundational을 기다릴 필요 없음
- **US1**: 두 코어 트랙은 상호 무의존. API 조립에서 T032(파트2)가 파트1 lib 산출물(T017·T021) 필요 — 코드 접점은 없음
- **US2**: 파트2 주도(T039~T041·T043은 T029·T032 의존), 파트1은 T042만(T037 의존)
- **US3**: Foundational만 의존 — US1과 병렬 가능(T050만 T031 의존). **파트1은 US1 코어(T012~T022) 완료 후 US3 화면(T044·T047·T048)으로 이동하는 흐름이 자연스러움**
- **US4**: T031(세션)·T034(녹음 훅) 의존, US2와 병렬 가능
- **US5**: Foundational만 의존 — 틈새 시간에 처리

### 트랙별 실행 순서 (마감 8/11~12 기준 권장 시퀀스)

```
파트1: T001·T002·T006 → T018(투표 요청, 최우선) → T012~T017·T020 → T019·T021·T022
       → [SttResult 전달 선언] → T009·T011(미완이면) → T030·T034·T035·T036
       → T044·T047·T048(US3) → T042(US2 팝업) → T053·T054(US4) → T056·T058 → T061·T062

파트2: T003·T004 → (T005 합의) → T007·T008·T010 → T023~T029
       → T031·T032·T033·T037 → T039~T041·T043(US2) → T045·T046·T049·T050(US3)
       → T051·T052·T055(US4) → T057·T059 → T063·T065

공동:  T005(Day 0) → T038(대화 배선, 양 트랙 UI 합류 시) → T060 → T064(마지막)
```

### Parallel Opportunities

- **Phase 내 병렬**: 모든 Phase가 파트1/파트2 트랙으로 분리되어 있어 Phase 단위로 2인 동시 진행 가능 — 같은 파일 충돌 없음
- **Phase 간 병렬**: 파트1의 US1 코어와 파트2의 US1 코어는 완전 병렬. 이후 파트1이 US3 화면을 하는 동안 파트2가 US2 판정·API를 진행하는 식의 엇갈림 배치 가능(위 시퀀스)
- **[P] 태스크**: 트랙 내부에서도 파일이 다른 [P] 태스크는 순서 무관

## Parallel Example: User Story 1 (2인 동시 착수)

```bash
# 파트1 — Day 0 오전:
Task: "scripts/tts-voices.ts 실행 → 팀 투표 요청"        # T018 ← 리드타임 최우선
Task: "STT 게이트 순수 함수 src/lib/stt/gates.ts"        # T012
Task: "타입캐스트 어댑터 src/lib/tts/typecast.ts"        # T016

# 파트2 — 같은 시간 (T005 합의 직후):
Task: "규칙 엔진 src/lib/rules/engine.ts + 테스트"       # T023·T024
Task: "분석 LLM src/lib/llm/analysis.ts"                # T025
Task: "캐릭터 생성 src/lib/llm/generate.ts"             # T027
```

## Implementation Strategy

### MVP First (US1만으로 데모 성립)

1. Phase 1~2를 트랙별로 병렬 완료 (T001~T011 + T005 합의) — 오늘 오전
2. US1 코어 양 트랙 병렬 (파트1 T012~T022 / 파트2 T023~T029) — 오늘~내일, CLI 통과가 완료 기준
3. API·UI 조립 (T030~T037 트랙별) → T038 공동 배선 → **quickstart §4-2~5로 검증 후 여기서 데모 가능**
4. 이후 엇갈림 배치: 파트1→US3 화면, 파트2→US2 미션 → US4 → US5

### 시간 부족 시 폴백 (R-17)

- 화면 조립이 밀리면: `simulate.ts` 텍스트 데모(파트2) + `stt-check`/`tts-check` 왕복 시연(파트1)으로 대체
- US5·배지 화면은 정적이므로 마지막까지 미뤄도 데모 훼손 없음

### 검증 체크포인트

- 동기화 포인트 3곳(#1 contracts 합의, #2 SttResult 전달, #3 T038 합류)에서만 상호 대기 — 그 외는 각자 트랙 진행
- 각 Phase 말 Checkpoint에서 quickstart 해당 절 실행
- 프롬프트 수정 시마다 `eval/run.ts` 회귀 (T028)
- 커밋은 태스크 단위 또는 논리 그룹 단위 — `contracts.ts`·`fixtures/` 변경 커밋은 상대 승인 후
