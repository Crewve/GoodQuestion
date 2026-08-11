# Tasks: 굿퀘스천 MVP — 아동 음성대화 학습 서비스

**Input**: Design documents from `/specs/001-goodquestion-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (모두 존재)

**Tests**: 문서 요구에 따라 포함 — 규칙 엔진·STT 게이트는 순수 함수 Vitest, 각 파트는 CLI 단독 검증(분담 원칙·R-13). 그 외 화면은 quickstart 시나리오로 검증.

**Organization**: 유저 스토리별 독립 구현·검증 + **모든 Phase를 2인 분담 트랙으로 분할**. 태스크 설명 앞의 `(파트1)`/`(파트2)`/`(공동)`이 담당 표기다.

## 2인 분담 원칙

| 트랙 | 영역 | 소유 파일 |
| --- | --- | --- |
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

- [x] T001 (파트1) 의존성 추가: `openai @supabase/supabase-js @supabase/ssr zustand` + dev `tsx vitest` — package.json (npm install; 이후 양 트랙 pull) ※ Node 20 호환용 `ws`·`@types/ws` 추가 (supabase-js v2.109+가 Node 22 네이티브 WebSocket 요구 — scripts/lib/supabase.ts 참고, 파트2 T004의 src/lib/supabase.ts도 동일 조치 필요)

- [x] T002 \[P\] (파트1) `.env.example` 작성(OPENAI_API_KEY·TYPECAST_API_KEY·NEXT_PUBLIC_SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY·모델 오버라이드 3종) + `.env.local` 실키 보강 — 타입캐스트 가입·키 발급 포함 (quickstart §0) ※ OPENAI_API_KEY·TYPECAST_API_KEY 실값 입력은 사람 작업으로 남음 (.gitignore에 !.env.example 예외 추가)

- [x] T006 \[P\] (파트1) Storage 버킷 생성 스크립트 `scripts/setup-buckets.ts` — `fixed-audio`·`tts-cache` 공개 읽기 버킷 생성(멱등), 실행 ✓ 2회 실행으로 멱등 확인, 공용 헬퍼 scripts/lib/{env,supabase}.ts 동봉

### 파트2 트랙

- [x] T003 \[P\] (파트2) 설정 로더 `src/lib/config.ts` — 역할별 모델명(기본 gpt-4o-mini)·STT 게이트 임계값(no_speech_prob 0.6, avg_logprob -1.0 등)을 env/상수로 분리 (R-02; 임계 기본값은 파트1과 항목 합의) ✓ 382c28b — 파트1 gates.test.ts가 기본값 정합 검증 중

- [x] T004 \[P\] (파트2) OpenAI 단일 클라이언트 `src/lib/openai.ts` + 서버 전용 Supabase service role 클라이언트 `src/lib/supabase.ts` (`server-only` 임포트로 클라이언트 번들 유입 차단) ✓ `server-only`는 tsx CLI에서 즉시 throw라 런타임 가드로 대체(코드 주석 사유) — 번들 검증은 T063. supabase.ts에 Node 20 ws transport 주입 추가(T001 비고 이행)

### 공동 (Day 0 합의 — 30분 타임박스)

- [x] T005 (공동) 공유 계약 타입 `src/lib/contracts.ts` — contracts/lib-contracts.md 초안을 파트2가 작성, 파트1 승인으로 확정 (ThinkingElement 8종·SttResult·AnalysisResult·ProgressDecision). 이후 변경은 상호 합의로만 ✓ 파트2 초안(382c28b) 검토 결과 계약 문서와 일치 — 파트1 승인 완료 (2026-08-10)

**🔗 동기화 포인트 #1**: T005 합의 완료 = 양 트랙 완전 병렬 시작 가능

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 의존하는 DB 데이터·레이아웃·인증 기반

**⚠️ CRITICAL**: 이 단계 완료 전에는 유저 스토리 착수 불가 (단, 트랙별로 자기 담당분만 끝나면 자기 스토리 트랙 착수 가능)

### 파트1 트랙

- [x] T009 \[P\] (파트1) 루트 레이아웃·디자인 토큰 — `src/app/layout.tsx`에 `next/font/local`(src/fonts의 Cafe24Ssurround+PretendardGOV 4웨이트), `src/app/globals.css`에 컬러 토큰 7종(Base #FFF8EE·Primary #FF7A3D 등) (R-14; next 폰트 문서 선독) ✓ Tailwind v4 @theme inline 연결(font-sans/font-display, bg-primary 등), lang=ko, 라이트 고정, next build 통과

- [x] T011 \[P\] (파트1) 에셋 URL 헬퍼 `src/lib/assets.ts` — `fixtures/storage-assets.json`의 base_url+key 조합, 장면 external_id→이미지 URL 매핑 ✓ 장면(대화3 2컷)·캐릭터·미션·아바타·추천 썸네일 헬퍼, 미등록 키 즉시 throw

### 파트2 트랙

- [x] T007 (파트2) 스키마 갭 마이그레이션 — **최종 확정 (2026-08-10, CLAUDE.md SSOT: 충돌 시 기능명세서 우선)**: 3컬럼 선적용→전면 롤백→사용자 승인 후 `supabase/migrations/001_children_profile_fields.sql`로 **children.birth_date·avatar_key 2컬럼만 재적용**. scene_type은 DB에 추가하지 않고 fixtures 파생(`src/lib/story.ts` sceneTypeOf) 유지. T045·T046은 기능명세서 원안대로(생년월일 8자리 저장·만 나이 배지·아바타 저장) 진행. Notion 설계서 개정 공유 필요(팀)

- [x] T008 (파트2) 시드 스크립트 `scripts/seed.ts` — `fixtures/story.banggui.json` → stories/story_scenes upsert(external_id→uuid 매핑 보존, 임시 채택값 R-08: 대화2 요소=장면 테이블, EXPRESSION→REASON, preferred_turns=max_turns), 실행·검증 (T007 의존) ✓ external_id→uuid는 결정적 UUIDv5(`src/lib/external-id.ts`+테스트 3건) — 매핑 파일 없이 서버·CLI 동일 계산, 2회 실행 멱등 확인, scenes 9/9

- [x] T010 \[P\] (파트2) Supabase Auth 연동 기반 — `src/lib/supabase-browser.ts`·`src/middleware.ts`(@supabase/ssr 세션 갱신·보호 라우트) (R-10) ✓ **Next 16.3: middleware.ts→**`src/proxy.ts` **개명**(문서 확인, export명 proxy). publishable 키 사용(NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — .env.example 갱신), 보호 프리픽스 6종 리다이렉트, API 401은 각 라우트 책임. next build 통과

**Checkpoint**: DB에 이야기 1편 시드 완료·폰트/토큰 적용·인증 미들웨어 동작

---

## Phase 3: User Story 1 - 이야기 진행: 음성 대화 턴 사이클 (Priority: P1) 🎯 MVP

**Goal**: 도입·전개 내레이션 재생과 대화 장면의 완전한 턴 루프(녹음→STT 게이트→분석→규칙→생성/고정 대사→TTS→재생). CLOSING은 사전 생성 오디오.

**Independent Test**: UI 없이 `stt-check`/`tts-check`/`simulate` CLI로 왕복 검증(quickstart §1·§2) → 화면 조립 후 대화1 장면 E2E(quickstart §4-2\~5).

**분담 구조**: 코어(T012\~T029)는 두 트랙이 서로를 전혀 기다리지 않는다. API 조립에서 파트1 lib를 파트2가 호출하며 합류하고, UI도 화면 파일 단위로 나눈다.

### 파트1 트랙 — 음성 I/O 코어 (CLI 단독 검증)

- [x] T012 \[P\] \[US1\] (파트1) STT 실패 게이트 순수 함수 `src/lib/stt/gates.ts` — 5종 순서(1\~2자→no_speech_prob→avg_logprob→n-gram 반복→자막체 상투구), 임계값은 config 주입 (R-02) ✓ 구간 길이 가중 평균, 상투구는 공백 무시 비교, 신호 수집 함수 분리(collectSignals — stt-check 튜닝 출력용)

- [x] T013 \[P\] \[US1\] (파트1) 게이트 단위 테스트 `src/lib/stt/gates.test.ts` — 무음·환각·정상 케이스 (Vitest) ✓ 10케이스 통과 (게이트 5종·순서 우선·가중 평균·설정 주입, config.ts 기본값 정합 포함)

- [x] T014 \[P\] \[US1\] (파트1) 장면별 prompt 힌트 빌더 `src/lib/stt/hints.ts` — fixtures 캐릭터명·핵심 단어, ≤224토큰 ✓ 직전 캐릭터 대사(GUIDED 질문) 우선 주입, Whisper가 prompt 끝부분을 쓰는 특성 반영해 핵심 어휘 후치·앞에서 절단

- [x] T015 \[US1\] (파트1) Whisper 어댑터+경량 교정 `src/lib/stt/index.ts` — verbose_json, 게이트 통과 후 gpt-4o-mini 교정(맞춤법·조사만, 실패 시 sttRawText 폴백), `SttResult` 반환, 오디오 즉시 폐기 (T012·T014 의존) ✓ speechToText() — SttResult+게이트 신호·duration 부가 반환(튜닝용), 교정은 과도 변형 시에도 원문 폴백, 보이스 샘플 mp3 실측 왕복 확인

- [x] T016 \[P\] \[US1\] (파트1) 타입캐스트 어댑터 `src/lib/tts/typecast.ts` — `synthesize(text, voiceId)→mp3 Buffer`, provider 인터페이스, 동시성 2 제한 큐 내장 (R-05; 가입·API 스펙 확인 선행) ✓ API 실측 확정: GET /v1/voices·POST /v1/text-to-speech(X-API-KEY, mp3 320kbps), model은 보이스별 자동 해석

- [x] T017 \[US1\] (파트1) TTS 2층 캐시 `src/lib/tts/cache.ts` + 진입점 `src/lib/tts/index.ts` — `hash(voiceId+text)`, 로컬 디렉토리(CLI)+`tts-cache` 버킷(런타임) (T016 의존) ✓ 로컬 히트 49ms·Storage write-through·공개 URL 200 검증. Storage 클라이언트는 주입 방식(파트2 supabase.ts Node20 이슈와 분리)

- [x] T018 \[P\] \[US1\] (파트1) 보이스 후보 스크립트 `scripts/tts-voices.ts` — 역할 4종×후보 2\~3개 샘플 mp3 생성, 즉시 실행해 팀 투표 요청 (**크리티컬 패스 — Day 0 최우선, 투표 리드타임**) ✓ 12건 생성(414자 사용, out/voice-samples/) — **팀 투표 대기 중, 확정 시 T019 진행**

- [x] T019 \[US1\] (파트1) 보이스 매핑 확정 `src/lib/tts/voice-map.json` — 투표 결과로 며느리·시아버지·마을 이장·내레이터 voice_id 기록 (T018 투표 의존) ✓ 고운=Gowoon·병훈=Byunghun·이장=장태백(Taebaek)·문정=Moonjung, 전부 ssfm-v30 + `voiceForRole()` 로더. 주의: 스튜디오 '캐릭터 캐스팅' 전용 보이스(동굴아저씨 등)는 개발자 API 카탈로그(v1·v2)에 없음 — 1차 선정 동굴아저씨는 API 부재로 팀이 장태백으로 재확정

- [x] T020 \[P\] \[US1\] (파트1) 왕복 검증 CLI `scripts/stt-check.ts`·`scripts/tts-check.ts` — SttResult+게이트 신호 전부 출력 / 텍스트→mp3 저장·캐시 히트 확인 ✓ 양쪽 완료 — stt-check: 게이트 신호 5종을 임계값과 병기 출력(--scene/--reply/--hint), 보이스 샘플 2건 실측 통과 (T022 튜닝 도구 겸용)

- [x] T021 \[US1\] (파트1) 사전 생성 스크립트 `scripts/pregenerate-audio.ts` — tts-lines 14건→mp3→`fixed-audio` 업로드(파일명 `{key}.mp3` 잠정 R-06, 'ㅇㅇ' 2건 '친구야' 치환 R-07, 멱등), 실행 (T019 의존) ✓ 14/14 업로드·공개 URL 전수 검증(신규 합성 939자, 투표 샘플 캐시 히트 3건 과금 절약). 치환은 조사까지 처리('ㅇㅇ아'→'친구야', 'ㅇㅇ이'→'친구'). 재실행 시 전건 스킵·0과금 확인, 재생성은 --force

- [x] T022 \[US1\] (파트1) 게이트 임계 1차 튜닝 — 직접 녹음한 아동 발화 근사 샘플 10\~20건(iPad audio/mp4·안드로이드 webm/opus 각각)으로 `stt-check` 실측, config 기본값 갱신 (T015·T020 의존) ※ 포맷 수용은 검증 완료: mp4(AAC)·webm(opus) 트랜스코드 샘플 모두 stt-check 정상 전사(2026-08-11) ✓ 실측 완료(2026-08-11): 배치 러너 `scripts/stt-tune.ts`(라벨 폴더 일괄 판정→신호 분포·오분류·임계 후보 자동 산출) + 안드로이드 실녹음 12건(정상 8·소음 2·1\~2자 2) **오분류 0 — 기본값 유지 확정**(분포는 config.ts 주석·out/stt-tune-report.json). 발견: 소음 입력은 Whisper가 힌트 어휘를 반복 환각(no_speech_prob 0.12\~0.15로 ②③ 미탐)하며 ④ n-gram(반복 7회 vs 정상 1회)이 주 방어선. 안드로이드 녹음기 앱 .m4a는 실제 3gp 컨테이너라 ffmpeg 재포장 필요(`docs/프로젝트/파트1_T022_녹음가이드.md` 기록, 실서비스 MediaRecorder와 무관). iPad 실녹음은 포맷 기검증이라 2차 튜닝으로 이월

**🔗 동기화 포인트 #2**: T022 완료 = 파트2에 "`SttResult` 인터페이스 전달 완료" 선언 (파트1 계획 §4-8)

### 파트2 트랙 — 대화 두뇌 코어 (CLI 단독 검증, 파트1과 동시 진행)

- [x] T023 \[P\] \[US1\] (파트2) 규칙 엔진 순수 함수 `src/lib/rules/engine.ts` — accumulated/missing 계산, turns_without_new_element·consecutive_low_information_turns 카운트, NORMAL/GUIDED(유도 1\~2개)/CLOSING 판정, 종료 이유 GOAL_MET/MAX_TURNS (FR-010; LLM 무관·문장 미생성) ✓ GOAL_MET이 MAX_TURNS 우선, GUIDED 임계는 config.rules(env 튜닝: RULES_GUIDED\_\*) 주입, guidanceTarget=required 순서상 첫 부족 요소(계약 타입 단수)

- [x] T024 \[P\] \[US1\] (파트2) 규칙 엔진 테스트 `src/lib/rules/engine.test.ts` — 누적 유지·모드 전환·최대 턴·조기 종료 케이스 (Vitest) ✓ 9케이스 — TDD 선행 작성(RED→GREEN), required 밖 요소 누적·마지막 턴 GOAL_MET 우선 포함

- [x] T025 \[P\] \[US1\] (파트2) 분석 LLM `src/lib/llm/analysis.ts` — 4필드 구조화 출력(child_intent/main_point/detected_elements/utterance_validity), 탐지는 항상 8요소 전체 명문화 (R-03) ✓ json_schema strict + 8요소 정의·validity 기준·intent 예시(Notion §5·§8), 파싱 실패 throw(재시도 근거), ANALYSIS_VERSION='mvp_v1', 순수부 테스트 5건

- [x] T026 \[P\] \[US1\] (파트2) 서버 후처리 `src/lib/llm/postprocess.ts` — evidence 원문 인용 검증·중복 정리·약한 탐지 보정, LLM 원본은 서버 로그로 보존(R-11-4) ✓ TDD 7케이스 — 공백 무시 매칭으로 원문 표기 보정, INVALID_TYPE/DUPLICATE/WEAK_EVIDENCE/NOT_QUOTED 사유 기록

- [x] T027 \[P\] \[US1\] (파트2) 캐릭터 생성 LLM `src/lib/llm/generate.ts` — fixtures/characters 페르소나 시스템 프롬프트, GUIDED 시 서버 지정 부족 요소만 유도, 아동 안전 가드레일+후검증(길이·금칙어) (FR-011) ✓ TDD 11케이스 — loadCharacter(fixtures SoT)·요소별 유도 화법 사전·후검증 160자/금칙어(재시도는 /api/turn 책임), 히스토리는 role 매핑 전달

- [x] T028 \[P\] \[US1\] (파트2) eval 골든 세트 `eval/cases.json`(모의 아동 발화 20\~30건 요소 라벨) + 회귀 러너 `eval/run.ts` ✓ 24건(장면 4×6, validity 5종 혼합) — expected는 핵심 최소 집합·재현율 기준, extra는 보고만. **실측 완료(2026-08-10): 프롬프트 2회 튜닝(mvp_v2 — 요소 예시·절 단위 복합 탐지·REASON 절 강조·SHORT 기준)으로 validity 24/24, 재현율 64.6%→89.6%. 잔여 3건은 경계 사례(과적합 방지 위해 중단)**

- [x] T029 \[US1\] (파트2) 시뮬레이션 CLI `scripts/simulate.ts` — 대본 입력→분석→후처리→판정→응답 루프 텍스트 출력 (T023·T025\~T027 의존, 데모 폴백 겸용 R-17) ✓ 시나리오 2종 동봉(happy-path=GOAL_MET·stagnant-guided=GUIDED→MAX_TURNS), CLOSING 시 LLM 미호출·고정 클로징 출력 명시, 'ㅇㅇ'→이름 치환. **실측 실행은 OPENAI_API_KEY 입력 후(사람 작업)**

### API 조립 (트랙별 소유 — Route Handler 착수 전 Next 16.3 문서 필독)

- [x] T030 \[US1\] (파트1) `src/app/api/stt/route.ts` — multipart 수신→힌트→Whisper→게이트→교정→`SttResult` 200, 무저장·즉시 폐기 (contracts/api-routes.md; T015 의존. api/ 중 이 파일만 파트1 소유) ✓ next dev 스모크 4케이스(정상 200·audio 누락 400·context 오류 400·손상 오디오 failed:true 200 폴백) 통과. sceneId는 sc\_\* 직해석·uuid는 시드(T008) 연동 전 기본 어휘 폴백. 선택 필드 characterReply 수용(계약 외 additive — 팀 공유 필요)

- [x] T031 \[US1\] (파트2) `src/app/api/sessions/route.ts` — 세션 시작/재개 지점 계산(scene_goal_met 기준, 도입은 항상 처음), scenes 페이로드(scene_type·이미지 URL·고정 오디오 URL)·진행률 n/N(전개+대화 쌍=1) (T007·T008 의존; 이미지 URL은 파트1의 T011 헬퍼 호출) ✓ 보호자-아이 소속 검증, 마지막 장면 완료 시 resumeSceneId=null(후속활동 단계), 보조 헬퍼 `supabase-server.ts`(인증)·`fixed-audio.ts`(R-06 키)·`story.ts`(uuid↔fixture)

- [x] T032 \[US1\] (파트2) `src/app/api/turn/route.ts` — 오케스트레이션 ①메시지 저장→②분석→③후처리→④utterance_analyses 저장→⑤규칙→⑥생성 또는 고정 대사→⑦TTS 캐시→⑧세션 갱신, 실패 시 1회 재시도·폴백 (파트1 lib는 `@/lib/tts` 인터페이스로만 호출 — T017·T021 산출물 의존, 코드 접점 없음) ✓ CLOSING=고정 클로징+fixed-audio URL(LLM/TTS 무관), 분석·생성 1회 재시도 후 502, TTS 실패·voice-map 미확정(T019 대기)이면 텍스트만 반환, raw 분석은 서버 로그 보존, 장면 전환 시 규칙 상태 리셋. ※ API 스모크는 OPENAI_API_KEY+가입 세션 필요(사람 작업)

### UI 조립 (화면 파일 단위 분담)

- [x] T033 \[P\] \[US1\] (파트2) 턴 상태머신 `src/store/turn.ts` — CHAR_SPEAKING→RECORDING→TRANSCRIBING→REVIEW→SUBMITTED 전이, 게이트 실패 시 RECORDING 복귀 (data-model §5) ✓ TDD 8케이스 — failed=true는 REVIEW 미진입, 잘못된 단계 전이 무시, 상태 배지 라벨 PHASE_LABELS 동봉(T037 소비)

- [x] T034 \[P\] \[US1\] (파트1) 오디오 훅 `src/hooks/useAudioUnlock.ts`·`src/hooks/useRecorder.ts` — 첫 제스처 언락(iPad), MediaRecorder(mp4/webm), RMS·최소 길이 사전 게이트, 30초 자동 종료 (R-15) ✓ 언락은 첫 pointerdown 1회(모듈 전역), mime 협상 webm;opus→webm→mp4, AnalyserNode 실시간 레벨+전구간 평균 RMS, precheckRecording 순수 함수(TOO_SHORT/TOO_QUIET), onComplete 콜백에 사전 게이트 결과 동봉

- [x] T035 \[P\] \[US1\] (파트1) 진행 공통 컴포넌트 `src/components/progress-header.tsx` — 진행률 텍스트·바(도입 n=1 고정)·X 나가기(상세 복귀) ✓ n/N 계산은 컨테이너 책임(도입=1, 전개k/대화k=k — 기능명세서 2.4.1·2.4.2), 터치 48px·텍스트 18px+·progressbar ARIA

- [x] T036 \[US1\] (파트1) 이야기 진행 컨테이너+도입/전개 화면 `src/app/play/[sessionId]/page.tsx`·`src/components/narration-scene.tsx` — scene_description 온점 분리 문장 자동 재생, 이전/다음 화살표(첫/끝 규칙)·다시 듣기·마지막 문장 진행하기 (T031 응답 스키마 의존 — contracts/api-routes.md 기준으로 병렬 개발 가능) ✓ 진입 경로 `?child=&story=`로 /api/sessions 멱등 호출(새로고침 재개 복원). **문장 단위 오디오는 T021 확장으로 사전 생성**(`{scene}__narration_s{i}.mp3` 15건, `src/lib/narration.ts` 분리 함수를 화면·스크립트 공유) — 신규 API 라우트 없음. 대화 장면은 T037 합류 자리표시자, next build·typegen 통과

- [x] T037 \[US1\] (파트2) 대화 화면 `src/components/dialogue-scene.tsx` — 캐릭터 대사 카드(이름·이미지·자동 재생)·상태 배지 3종·대화 내역 리스트·마이크/보내기 버튼·STT 미리보기(수정 불가) (T033 의존, 파트1의 T034 훅 임포트) ✓ props `{sessionId, scene, childName?, onSceneEnd}` — T038은 page.tsx 자리표시자를 `<DialogueScene>`으로 교체하고 `childName`(세션 응답 추가 필드) 전달만 하면 됨. 폴백: 게이트/STT 실패 "다시 한번 말해줄래?"+마이크 재클릭, 턴 실패 다시 보내기, TTS 없음 텍스트만 진행, 자동재생 차단은 다시 듣기 복구. **R-07 확정(실명 호출) 동반 구현**: `src/lib/child-name.ts`(받침 조사 처리, 테스트 6건)·`/api/sessions` 실명 오프닝 런타임 TTS(캐시·3.5초 예산·'친구야' 폴백)+`childName` 응답 추가·`/api/turn` childName 전달 — research.md R-07·api-routes.md 개정, next build·vitest 59/59 통과

- [x] T038 \[US1\] (공동) 턴 사이클 배선 — 캐릭터 오디오 종료→마이크 자동 시작, 보내기→`/api/turn`→응답 재생, CLOSING→고정 오디오 재생 후 다음 장면 전환(대화 마지막이면 학습완료로) (T030·T032·T036·T037 의존 — 페어로 진행, 통합 이슈 즉석 해결) ✓ page.tsx 자리표시자→`<DialogueScene>` 교체(+SessionPayload에 childName·openingText). **리허설 E2E**: 테스트 계정 시드 `scripts/dev-test-user.ts`(민준) → 도입·전개·대화1 진입, 실명 오프닝("민준아") tts-cache 합성본 재생·상태 배지 확인, `/api/turn` 실왕복 2턴 — 1턴 NORMAL(REASON·SOLUTION 탐지, 생성 대사 실명 호출, 6.8초), 2턴 CLOSING(GOAL_MET, fixed-audio 클로징, nextSceneId, 2.4초), 재개 지점 order 4·진행률 1/4 확인. **통합 버그 3건 수정**: story_sessions·messages·utterance_analyses insert에 id/타임스탬프 클라이언트 생성 추가(스키마에 DB 기본값 없음 — Notion 설계서 원형, 첫 실행 경로에서 발견). 잔여 사람 작업: 실기기 마이크 녹음 리허설(자동화 탭은 오디오 재생 시 렌더러 프리즈 — 환경 이슈)

**🔗 동기화 포인트 #3**: T038 = 양 트랙 합류. quickstart §1·§2 CLI 전항 + §3 API 스모크 + 대화1 E2E — **여기까지가 데모 가능한 MVP**

---

## Phase 4: User Story 2 - 미션 노출과 수행 (Priority: P2)

**Goal**: 대화3(미션1)·대화4(미션2)에서 노출 조건 충족 시 오버레이 팝업 미션, 음성 응답, 결과의 대화 반영.

**Independent Test**: `simulate`에 미션 시나리오 대본 4종(노출 조건별) → 노출 판정·반영 확인, 화면에서 대화3 E2E(quickstart §4-4).

**분담 구조**: 판정·API는 파트2, 팝업 UI는 파트1 — US3(파트1 화면 다수)과 동시 진행 시 파트1 부하를 고려해 팝업만 배정.

### 파트1 트랙

- [x] T042 \[P\] \[US2\] (파트1) 미션 오버레이 팝업 `src/components/mission-popup.tsx` — 화면 전환 없는 단일 오버레이, \[진행 중\]→\[성공 완료\] 내부 전환, 마이크는 버튼 시작(자동 아님, T034 훅 재사용), 이야기 계속하기로 복귀 (T037 의존) ✓ 완료(2026-08-11): 팝업 로컬 단계(IDLE→RECORDING→TRANSCRIBING→REVIEW→SUBMITTING→SUCCESS)로 전역 turn 스토어(T033)와 분리, `/api/stt` context=mission 재사용(사전 게이트·"다시 한번 말해줄래?" 폴백은 대화 화면과 동일 규칙), fixtures missions 직접 로드(제목·목표·guide_points/examples 렌더, 미션 이미지 T011 헬퍼). **배선 접점은 콜백 2개뿐**: `onSubmit(text, sttRawText)`(resolve→성공 전환, reject→다시 보내기)·`onContinue` — T041 완료 후 dialogue-scene에서 exposeMission 조건부 렌더+콜백 연결만 하면 됨. 성공 콘텐츠는 MVP 고정 문구. ⚠️ 명세 내부 상충 발견: 기능명세서 2.4.3 구성요소 표는 "마이크 자동 활성화 아님", 기능 설명 ⓐ는 "자동 시작" — 구성요소 표·본 태스크 확정대로 버튼 시작 구현(팀 공유 필요). tsc·eslint·next build 통과

### 파트2 트랙

- [x] T039 \[P\] \[US2\] (파트2) 미션 설정 로더 `src/lib/missions.ts` — fixtures `missions` 키(goal·guide_points·expose_conditions·examples) 로드, 장면 매핑(sc_banggui_07/09) (R-11-3) ✓ mission_1(조건형)·mission_2(시점형) 스키마 차이를 공통 타입으로 정규화, 장면 매핑은 fixture scene 필드 파생, 미등록 키 throw

- [x] T040 \[US2\] (파트2) 미션 노출 판정 `src/lib/rules/mission.ts` + `src/lib/rules/mission.test.ts` — expose_conditions 4종을 분석 결과·턴 수 기반 순수 함수로 판정, 노출은 장면당 1회 (T039 의존; 미션 결과는 요소 확인에 활용 — 정답 판정 아님) ✓ TDD 9케이스 — 형식화: ①SOLUTION 탐지 ②REASON·DECISION만+SOLUTION 미누적 ③2턴+SOLUTION 미누적 ④연속 저정보 2턴, 미션2=VALID+자기긍정 요소(REASON·EMOTION·PERSPECTIVE)/2턴 폴백. 장면당 1회는 story_sessions.mission_phase(002 마이그레이션, 사용자 승인 — R-18)

- [x] T041 \[US2\] (파트2) `/api/turn` 미션 분기 확장 — `isMission` 입력 처리(미션 응답도 메시지·분석 동일 경로), 응답에 `exposeMission`·`missionPhase` 포함, 미션 완료를 CLOSING 조건 ③에 반영 (T032·T040 의존) ✓ 노출 턴=캐릭터 응답·저장 없음(팝업만, missionPhase:'progress'), 미션 응답 턴=동일 경로+missionPhase:'success'+다음 대사 동봉, 조건 ③은 GOAL_MET 자연 수렴+미수행 GOAL_MET 종료 보류(R-18 해석 — 충돌 기록), 종료 턴 미노출. api-routes.md 미션 행 추가(T042 소비 기준)

- [x] T043 \[US2\] (파트2) 미션 시나리오 검증 — `scripts/scenarios/mission-*.json` 대본 4종 작성, `simulate` 실행·eval 케이스 추가 (T029·T040 의존) ✓ simulate.ts에 미션 판정 미러 통합(턴 객체 isMission 지원), 4종 실측: solution(①즉시)·direction(②)·stall(③2턴)·mission2(자기긍정 후) 전부 노출→응답→GOAL_MET+mission=completed. eval 미션 응답 4건 추가 — m2 재해석 유형이 PERSPECTIVE 미탐지되는 갭 발견, 분석 프롬프트 mvp_v3(PERSPECTIVE에 단점→장점 재해석 포함)로 재현율 83.9%→92.9%, validity 28/28, 기존 실패 5건→2건

**Checkpoint**: US1 + 미션 포함 대화3·대화4 전체 흐름 동작

---

## Phase 5: User Story 3 - 진입 여정: 로그인→프로필→홈→이야기 선택 (Priority: P2)

**Goal**: 보호자 가입·아이 프로필(1\~3명)·홈(이어하기/추천)·목록(필터)·상세→시작하기.

**Independent Test**: 회원가입→프로필 등록→홈→상세→시작하기 클릭 경로 E2E(quickstart §4-1\~2), 이어하기 재개 지점 확인.

**분담 구조**: 화면 파일 단위로 3(파트1) : 4(파트2). 파트1은 카드·선택 UI, 파트2는 폼 검증·DB 연동이 무거운 화면.

### 파트1 트랙

- [ ] T044 \[P\] \[US3\] (파트1) 로그인 화면 `src/app/(auth)/login/page.tsx` — 이메일/소셜 탭 전환, Supabase Auth signIn, 에러 문구 3종(기능명세서 1.1), 성공 시 프로필 선택 이동 (소셜은 카카오 1개 — 심사 지연 시 구글 대체 R-10)

- [ ] T047 \[P\] \[US3\] (파트1) 아이 프로필 선택·추가 화면 `src/app/profiles/page.tsx` — 카드 최대 3+추가 카드(3명 시 숨김), 만 나이 배지 계산, 선택 시 홈 진입(아이 컨텍스트), 2.1.1 추가 폼 재사용

- [ ] T048 \[P\] \[US3\] (파트1) 홈 화면 `src/app/home/page.tsx` — 인사말(성 제외 이름), 이어하기 카드(진행률 n/N·%·계속하기) 조건 노출, 추천 3×2 6개(첫 카드 '방귀 뀌는 며느리' 고정·유일 클릭 가능), GNB(단어장 이동 없음) (진행률은 T031 응답 재사용)

### 파트2 트랙

- [x] T045 \[P\] \[US3\] (파트2) 회원가입 2단계 화면 `src/app/(auth)/signup/page.tsx` — 순차 인디케이터, 1단계 계정 생성(이메일 중복·비번 8\~20 규칙·약관 전체동의; SMS 인증은 미구현 범위 축소 R-10), 2단계 아이 탭 1\~3명(캐릭터 4종·이름·생년월일 YYYYMMDD·아동 동의 1회), 검증 시점 규칙(탭별/전체) (T010 의존) ✓ 검증 규칙·명세 문구는 `src/lib/auth/signup-validation.ts` TDD 26건 단일 소스, SMS 미배치(R-10), 중복 이메일은 signUp 응답 판정(에러 코드+identities 빈 배열 → 1단계 복귀), 프로필 저장은 POST `/api/profiles` 호출로 확정(T046 구현 대상), 성공 시 `/profiles` 이동. 브라우저 실측: 1→2단계 전환·탭 생성/전환 값 유지·탭별/전체 검증 시점·버튼 활성 조건 확인

- [x] T046 \[US3\] (파트2) 프로필 저장 처리 — Server Action 또는 `src/app/api/profiles/route.ts`: parents/children(avatar_key·birth_date)/child_consents 기록 (T007 의존; T045·T047 폼이 공용 호출) ✓ POST `/api/profiles`로 확정. 페이로드 검증은 `src/lib/auth/profiles-payload.ts` TDD 9건(T045 규칙 재사용), parents는 없을 때만 생성(name=이메일 로컬파트), birth_year는 birth_date 파생, 동의는 아이별 1행(mvp_v1·authenticated_parent), 보호자당 총 3명 제한 API 강제(T047 대비). E2E 실측: 201 등록·400 총원 초과·401 미인증·3테이블 기록 확인. ⚠️ 프로젝트 Auth 'Confirm email' 활성 상태 발견 — 즉시 가입 흐름 위해 대시보드 비활성 필요(research R-10 발견 항목, 데모 전 팀 작업)

- [ ] T049 \[P\] \[US3\] (파트2) 이야기 목록·상세 `src/app/stories/page.tsx`·`src/app/stories/[storyId]/page.tsx` — 주제·난이도 단일 선택 AND 필터·빈 상태, 상세(stories 데이터+고정 문구 '이런 것을 배워요')·시작하기 (Server Component 직접 조회)

- [ ] T050 \[US3\] (파트2) 시작하기→세션 연결 — `/api/sessions` 호출, 진행 이력 유무별 재개/신규 라우팅(`/play/[sessionId]`) (T031·T049 의존)

**Checkpoint**: 가입부터 이야기 시작까지 전체 여정 + US1 대화 진입

---

## Phase 6: User Story 4 - 학습 완료 후속 활동 (Priority: P3)

**Goal**: 카드 순서 배열(서버 판정·재시도)→핵심 단어 재구성 발화→학습 완료 화면·세션 완료 처리.

**Independent Test**: 카드 오답→정답→재구성→완료 화면→이어하기 제외 (quickstart §4-6), 재진입 라우팅 3분기 확인.

**분담 구조**: 인터랙션 화면 2개(파트1) : 콘텐츠·API·완료 처리(파트2).

### 파트1 트랙

- [ ] T053 \[P\] \[US4\] (파트1) 카드 배열 화면 `src/components/card-ordering.tsx` — 4장 무작위 제시·슬롯 1\~4 드래그앤드롭+Tap-to-Move(FR-020), 4칸 채움 시 제출, 오답 시 배치 유지·재제출, 정답 버튼 노출

- [ ] T054 \[P\] \[US4\] (파트1) 재구성 발화 화면 `src/components/retelling.tsx` — 카드 4컷+핵심 단어 표시, 마이크 버튼 시작 녹음·STT 결과 표시·보내기 (T034 useRecorder 재사용)

### 파트2 트랙

- [ ] T051 \[US4\] (파트2) 임시 post_activity_config 저작 — 장면 이미지 4장+정답 순서+핵심 단어 4개를 `fixtures/story.banggui.json`에 추가(스키마 R-09, fixtures 변경이므로 파트1에 공유), `scripts/seed.ts` 재실행 반영 (기획 회신 시 데이터만 교체)

- [ ] T052 \[US4\] (파트2) `src/app/api/post-activity/route.ts` — card-order 서버 판정(프런트 판정 금지)·attempt_count 증가 upsert, retelling 저장·completed_at·세션 완료 처리 (contracts/api-routes.md; T051 의존)

- [ ] T055 \[US4\] (파트2) 학습 완료 화면 `src/app/complete/[sessionId]/page.tsx` — 완료 안내·오늘의 이야기·배지 카드·이동 버튼 2종, 완료 이야기 이어하기 제외 확인 + 재진입 라우팅(completed_at/is_order_correct 분기) (T052 의존)

**Checkpoint**: 이야기 시작→학습 완료까지 풀 코스 동작

---

## Phase 7: User Story 5 - 마이페이지·시스템 메뉴 (Priority: P3)

**Goal**: 내정보·프로필 관리·공지/고객센터/이용안내·배지(정적)·로그아웃.

**Independent Test**: 각 메뉴 진입·표시·이동 경로, 로그아웃 확인 팝업→로그인 화면.

**분담 구조**: 화면 2 : 2 — 전부 \[P\], 남는 쪽이 가져가도 무방한 저위험 정적 화면.

### 파트1 트랙

- [ ] T056 \[P\] \[US5\] (파트1) 내정보 `src/app/my/page.tsx` — 로그인 방식 문구, 아이 프로필 리스트(표시 전용), 주간 요약 카드 3종, 메뉴 버튼, 로그아웃 확인 팝업 (기능명세서 3.1)

- [ ] T058 \[P\] \[US5\] (파트1) 공지사항·고객센터·이용안내 `src/app/my/notices/page.tsx`·`src/app/my/support/page.tsx`·`src/app/my/guide/page.tsx` — 목록/아코디언 정적 콘텐츠+빈 상태 문구

### 파트2 트랙

- [ ] T057 \[P\] \[US5\] (파트2) 프로필 관리 `src/app/my/profiles/page.tsx` — 목록+아이 추가(2.1.1 폼 재사용, 3명 제한)

- [ ] T059 \[P\] \[US5\] (파트2) 배지 화면 `src/app/my/badges/page.tsx` — 피그마 원안 정적 UI(미션 단계·진행바 3/7·동화 카드 8종, 데이터 연동 없음)

**Checkpoint**: 전 화면 내비게이션 완결

---

## Phase 8: Polish & Cross-Cutting Concerns

**분담 구조**: 파트1=오디오·UI 의무 사항, 파트2=보안·문서, 리허설 2건은 공동.

### 파트1 트랙

- [ ] T061 \[P\] (파트1) 타입캐스트 출처 표기 노출 — 시연 화면 공통 푸터/크레딧 `src/components/attribution.tsx` (무료 플랜 의무 — 잊기 쉬움, FR-013)

- [ ] T062 \[P\] (파트1) UI 가이드 점검 — 아이 화면 최소 18px·터치 48px·대비 4.5:1·색+아이콘+텍스트 병행·스크롤 미허용, 보호자 Header/GNB 고정 (핸드오프 가이드 전 조항)

### 파트2 트랙

- [ ] T063 \[P\] (파트2) 보안·프라이버시 확인 — `next build` 후 클라이언트 번들 키 3종 검색, 원본 음성 미저장(임시 파일 포함) 확인 (quickstart §5)

- [ ] T065 \[P\] (파트2) 문서 갱신 — `docs/프로젝트/프로젝트_디렉토리_명세.md` §3을 실제 구조로 갱신, research.md 미해결 7건 회신 결과 반영

### 공동 (통합 리허설)

- [ ] T060 (공동) 장애 폴백 리허설 — TTS 키 제거 상태 CLOSING 재생, LLM 장애 1회 재시도·고정 대사 폴백, max_turns 직전 타임아웃 강제 종료 (contracts/api-routes.md 폴백 매트릭스 전항)

- [ ] T064 (공동) quickstart.md 전체 검증 실행 — §1\~§4 E2E 데모 시나리오 리허설, 타입캐스트 사용량·무료 한도 재확인 (T060 이후 마지막)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (P1)** → **Foundational (P2)** → 유저 스토리들 → **Polish**
- 트랙 단위 완화: 파트1은 T009·T011만 끝나면 US1 파트1 트랙 착수 가능, 파트2는 T007·T008·T010 완료 후 US1 파트2 트랙 착수 — 상대 트랙의 Foundational을 기다릴 필요 없음
- **US1**: 두 코어 트랙은 상호 무의존. API 조립에서 T032(파트2)가 파트1 lib 산출물(T017·T021) 필요 — 코드 접점은 없음
- **US2**: 파트2 주도(T039\~T041·T043은 T029·T032 의존), 파트1은 T042만(T037 의존)
- **US3**: Foundational만 의존 — US1과 병렬 가능(T050만 T031 의존). **파트1은 US1 코어(T012\~T022) 완료 후 US3 화면(T044·T047·T048)으로 이동하는 흐름이 자연스러움**
- **US4**: T031(세션)·T034(녹음 훅) 의존, US2와 병렬 가능
- **US5**: Foundational만 의존 — 틈새 시간에 처리

### 트랙별 실행 순서 (마감 8/11\~12 기준 권장 시퀀스)

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
- **\[P\] 태스크**: 트랙 내부에서도 파일이 다른 \[P\] 태스크는 순서 무관

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

1. Phase 1\~2를 트랙별로 병렬 완료 (T001\~T011 + T005 합의) — 오늘 오전
2. US1 코어 양 트랙 병렬 (파트1 T012\~T022 / 파트2 T023\~T029) — 오늘\~내일, CLI 통과가 완료 기준
3. API·UI 조립 (T030\~T037 트랙별) → T038 공동 배선 → **quickstart §4-2\~5로 검증 후 여기서 데모 가능**
4. 이후 엇갈림 배치: 파트1→US3 화면, 파트2→US2 미션 → US4 → US5

### 시간 부족 시 폴백 (R-17)

- 화면 조립이 밀리면: `simulate.ts` 텍스트 데모(파트2) + `stt-check`/`tts-check` 왕복 시연(파트1)으로 대체
- US5·배지 화면은 정적이므로 마지막까지 미뤄도 데모 훼손 없음

### 검증 체크포인트

- 동기화 포인트 3곳(#1 contracts 합의, #2 SttResult 전달, #3 T038 합류)에서만 상호 대기 — 그 외는 각자 트랙 진행
- 각 Phase 말 Checkpoint에서 quickstart 해당 절 실행
- 프롬프트 수정 시마다 `eval/run.ts` 회귀 (T028)
- 커밋은 태스크 단위 또는 논리 그룹 단위 — `contracts.ts`·`fixtures/` 변경 커밋은 상대 승인 후