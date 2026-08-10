# Research: 굿퀘스천 MVP

**Date**: 2026-08-10 · **Input**: `docs/`·`design/`·`fixtures/` 전수 검토 + Supabase 실스키마 조회(PostgREST OpenAPI)

모든 결정은 이미 팀 문서에서 검토·확정된 사항을 우선 채택하고, 미확정 항목만 잠정 결정(기획 회신 시 데이터/설정만 교체 가능한 형태)로 둔다.

## R-01. AI 모델 구성

- **Decision**: STT=OpenAI Whisper API(`whisper-1`, `verbose_json`, 장면별 prompt 힌팅 ≤224토큰), 교정·분석·캐릭터 생성=`gpt-4o-mini`(역할별 env `STT_CORRECTION_MODEL`/`ANALYSIS_MODEL`/`GENERATION_MODEL`로 개별 상향 가능), TTS=타입캐스트 무료 플랜.
- **Rationale**: `AI 모델 선정 보고서`·Decision Log에서 기확정. 무료/저비용 한도 내 해커톤 시연 가능.
- **Alternatives considered**: gpt-4o(비용↑, 품질 미달 시 생성만 상향하는 escape hatch로 보류), 로컬 Whisper(운영 부담), 타 TTS(한국어 아동 친화 보이스·무료 한도에서 타입캐스트 우위 — tts_analysis).

## R-02. STT 실패 게이트·교정 파이프라인

- **Decision**: `stt_analysis.md` §3의 3단계 그대로 — Whisper(verbose_json) → 실패 게이트(순서: ①공백 제거 후 1~2자 ②`no_speech_prob`>0.6 ③`avg_logprob`<-1.0 ④n-gram 반복 ⑤자막체 상투구) → gpt-4o-mini 경량 교정(맞춤법·띄어쓰기·조사만, 의미 변경 금지, 실패 시 `text=sttRawText` 폴백). 임계값은 상수가 아닌 설정값으로 분리해 실측 튜닝. 게이트는 순수 함수로 분리해 API 없이 단위 테스트. 원본 음성은 변환 후 즉시 폐기.
- **Rationale**: Whisper 무음 환각 대응책으로 기확정. 게이트 실패 시 메시지 미생성(턴 카운트 제외)은 연동기준 검토 §1-4에서 정합 확인됨.
- **Alternatives considered**: 클라이언트 RMS·최소 길이 사전 게이트 — UI 단계 몫으로 순수 함수만 제공(파트1 계획 §5).

## R-03. 분석 출력 스키마 — `main_point` 유지, 탐지는 8요소 전체

- **Decision**: 4필드 required(`child_intent`/`main_point`/`detected_elements[{type, evidence}]`/`utterance_validity`) 구조화 출력. 분석 LLM은 항상 8요소 전체(DECISION~REQUEST)를 탐지하며, `elementCriteria`/`targetElements`는 인정 기준·참고 입력일 뿐 탐지 범위를 제한하지 않는다. evidence는 발화 원문 인용 — 서버 후처리(인용 검증·중복 정리·약한 탐지 보정)로 집행. LLM 원본(raw)과 확정본 병행 저장, 진행 판단은 확정본만 사용.
- **Rationale**: `연동기준_충돌검토.md` §2-B(4필드 유지 권고)·§2-C(탐지 범위 명문화)·§2-D(raw/확정 병행) 그대로. EMOTION 미탐지 시 감정분석 요건 파손 방지.
- **Alternatives considered**: 3필드(새 문서) — 기확정 산출물 3곳과의 정합 비용으로 기각.

## R-04. CLOSING 처리

- **Decision**: 서버 규칙이 CLOSING 확정 시 캐릭터 LLM 미호출, `story_scenes.character_closing` 사전 생성 mp3 재생. 최대 턴 도달·목표 미충족 시에도 "짧은 반응 → character_closing" 후 이동.
- **Rationale**: 2026-08-07 사용자 확정(연동기준 §2-A). 아동 안전·시연 안정성·비용 0.
- **Alternatives considered**: LLM 생성 마무리 — 폐기 확정된 서술.

## R-05. TTS 어댑터·캐시·사전 생성

- **Decision**: 타입캐스트 REST 어댑터 1개(`synthesize(text, voiceId) → mp3 Buffer`)를 provider 인터페이스로 감싸고, 호출부에 동시성 2 제한 큐 내장. 캐시 2층: 로컬 디렉토리(CLI/배치) + Storage `tts-cache` 버킷(`hash(voiceId+text).mp3`). 고정 대사 14건은 `pregenerate-audio` 스크립트로 일괄 생성해 `fixed-audio` 버킷 업로드(멱등). 시연물에 출처 표기.
- **Rationale**: 파트1 계획 §3-2. 무료 한도(월 3만 자·동시 2·출처 표기) 대응.
- **Alternatives considered**: 런타임 TTS 전면 사용 — 지연·한도·장애 리스크로 고정 대사는 사전 생성이 기확정.

## R-06. 고정 오디오 파일명 컨벤션 [팀 합의 필요 → 잠정]

- **Decision (잠정)**: `tts-lines`의 `key` 사용(`sc_banggui_03__opening.mp3`).
- **Rationale**: 장면 무관 시스템 대사까지 일관 처리(파트1 계획 §3-2 제안). 디렉토리 명세의 `{scene}_{character}.mp3`와 다르므로 Day 0 합의 항목.
- **Alternatives considered**: `{scene}_{character}` — 시스템 대사 처리 불가.

## R-07. 'ㅇㅇ'(아이 이름) 자리표시자 [기획 확인 대기 → 잠정]

- **Decision (잠정)**: 대화1·대화4 오프닝 2건은 '친구야' 치환본으로 사전 생성. 기획이 실명 호출을 원하면 해당 2건만 런타임 TTS로 전환.
- **Rationale**: 파트1 계획 §5 권고안 (a). 이어붙이기는 품질 리스크로 제외.

## R-08. 콘텐츠 불일치 임시 채택 (fixtures README 표 준수)

- **Decision**: ①대화2 required_elements=장면 테이블 `[PERSPECTIVE, EMOTION, REASON, SOLUTION]` ②대화1 `EXPRESSION`→`REASON` ③`preferred_turns`=null → 시드 시 `max_turns`와 동일값(참고용 필드, 규칙 엔진 종료 판정에는 미사용) ④대화3 어미=장면 테이블('없었소') ⑤시스템 문구=proposal 유지. 기획 회신 시 fixtures 재추출→시드 재실행으로만 교체.
- **Rationale**: fixtures/README 임시 채택 열 + "콘텐츠는 하드코딩 금지, fixtures→DB 시드 경유" 공용 규칙.

## R-09. `post_activity_config` 미정의 [기획 확인 대기 → 잠정]

- **Decision (잠정)**: 장면 카드 4장(도입·전개 이미지 재사용) + 정답 순서 + 핵심 단어 4개를 임시 저작해 `stories.post_activity_config`(JSON)에 시드. 스키마: `{ cards: [{id, image_key, label}], answer_order: [id...], keywords: [string...] }`.
- **Rationale**: 학습완료 2화면(2.4.4/2.4.5)이 필수 요건인데 콘텐츠가 미정의(불일치 #4). 서버 판정 로직·화면은 config-driven으로 만들어 콘텐츠 교체만으로 대응.

## R-10. 인증 — Supabase Auth, SMS 본인인증은 범위 제외

- **Decision**: Supabase Auth 이메일/비밀번호 + 소셜 1개(카카오; Supabase 기본 provider 지원. 심사 지연 시 구글로 대체). 휴대폰 SMS 인증번호(기능명세서 1.2.1)는 MVP에서 **UI만 배치하거나 생략**하고 실발송 미구현 — 기획에 범위 축소 공유. `parents.id`는 `auth.users.id`와 1:1.
- **Rationale**: SMS는 별도 유료 프로바이더(Twilio 등) 연동이 필요해 3~4일 일정에 비현실적. MVP 요건 원문은 "소셜 포함 최소 1개 이상 연동"으로 이메일+소셜 1개면 충족.
- **Alternatives considered**: Supabase Phone Auth(Twilio) — 비용·시간 대비 데모 가치 낮음.

## R-11. DB 실스키마 확인 결과와 갭 (2026-08-10 PostgREST 조회)

- **확인된 테이블 11개**: `parents`, `children`, `child_consents`, `stories`, `story_scenes`, `story_sessions`, `messages`, `utterance_analyses`, `post_activity_results`, `reports`, `wordbook`.
- **갭(기능명세서 대비) → 조치 결정**:
  1. `story_scenes.scene_type` 없음(도입/전개/대화 구분 불가, 진행률 계산 필요) → **컬럼 추가 마이그레이션** (기능명세서 비고에서 명시 요청).
  2. `children`에 아바타 캐릭터·생년월일(YYYYMMDD) 없음(`birth_year`만 존재) → **`avatar_key` 추가 + 생년월일은 `birth_date` 추가**(만 나이 배지 요건). Notion DB 문서가 SoT이므로 팀 공유 후 반영.
  3. 미션 테이블 없음 → MVP에서는 **DB 신설 대신 `fixtures/story.banggui.json`의 미션 데이터(expose_conditions 포함)를 서버 설정으로 로드**. 기능명세서의 "별도 테이블 필요"는 정식 개정 시 반영(연동기준 §2-A의 스키마 추가 보류 방침과 일관).
  4. `utterance_analyses`에 raw JSON 컬럼 없음 → R-03의 병행 저장은 **`analysis_version`+`detected_elements`(확정본) 저장 + raw는 로그/컬럼 추가 협의**. 추가 협의 전까지 서버 로그로 raw 보존.
  5. 캐릭터 페르소나·voice_id 테이블 없음 → **저장소 JSON**(`fixtures/characters.banggui.json` + `src/lib/tts/voice-map.json`)으로 관리.
  6. `element_criteria`/`element_worries` — Notion 요구사항 개정 전까지 **추가 보류**(연동기준 §2-A 확정). 분석 프롬프트에는 fixtures의 scene_goal 등 기존 데이터만 주입.

## R-12. 프로젝트 구조·계약 위치

- **Decision**: `프로젝트_디렉토리_명세.md` §3의 확장 예정 구조 채택 — `src/lib/{stt,tts,llm,rules}`, `src/app/api/{stt,turn}`, `src/components`, `src/store`(Zustand), `src/hooks`. 공유 계약 타입은 **`src/lib/contracts.ts`**(`@/lib/contracts`) — 분담안의 `lib/server/…` 표기 대신 디렉토리 명세 기준(파트1 계획 §6 권고안).
- **Rationale**: 경로 불일치 해소 권고안 그대로. `@/` 별칭 기존 설정 활용.

## R-13. 테스트·검증 체계

- **Decision**: Vitest — `src/lib/rules/*.test.ts`(누적·모드·종료 판정), STT 게이트 순수 함수 테스트. CLI 검증 스크립트 4종(`tts-voices`, `tts-check`, `stt-check`, `pregenerate-audio`) + 파트2 `simulate.ts`(대본→분석→규칙→응답 루프), eval 골든 세트 20~30건(요소 라벨)으로 프롬프트 회귀 확인. 실행은 `tsx` + `.env.local` 로드.
- **Rationale**: 분담 원칙 "각 파트는 프론트 없이 CLI 단독 검증 가능" + 디렉토리 명세의 Vitest 계획.

## R-14. UI 구현 기준

- **Decision**: 태블릿 가로 1194×834 시안 기준 반응형(상대 단위), 우선순위 태블릿→PC(max-width 제한+여백 확장)→모바일 가로. 아이 화면: 스크롤 미허용·최소 18px/line-height 1.5·터치 48px·색+아이콘+텍스트 병행·대비 4.5:1. 보호자 화면: Header/GNB fixed·스크롤 허용·16px. 폰트는 `next/font/local`로 `src/fonts/`의 Cafe24Ssurround(헤드라인)+PretendardGOV 서브셋 4웨이트(본문). 세부 수치는 피그마 `개발 배포용` 페이지에서 직접 추출. 카드 배열은 드래그앤드롭 + Tap-to-Move 병행.
- **Rationale**: `UI 디자인-개발 핸드오프 가이드.md` 전 조항 + design/README 디자인 토큰(Base `#FFF8EE`·Primary `#FF7A3D` 등 7색). 헤드라인 폰트는 전달본 Cafe24Ssurround 채택(피그마 Jua 표기는 확인 대기).

## R-15. 오디오 재생·녹음 (클라이언트)

- **Decision**: `useAudioUnlock`(첫 사용자 제스처에서 AudioContext 언락 — iPad Safari 자동재생 정책 대응), `useRecorder`(MediaRecorder, iPad `audio/mp4`·안드로이드 `webm/opus` 모두 서버에서 수용), 녹음 최대 30초 자동 종료, RMS·최소 길이 사전 게이트 순수 함수 적용. 캐릭터 대사 재생 종료 이벤트로 마이크 자동 시작(미션 팝업은 버튼 시작).
- **Rationale**: 기능명세서 2.4.3 상태·턴 사이클 + 파트1 계획 §5(포맷별 확인)·§3-1.

## R-16. Next.js 16.3 주의

- **Decision**: 모든 Next.js 코드 작성 전 `node_modules/next/dist/docs/` 해당 가이드를 먼저 읽는다(레포 AGENTS.md 경고 — 관례가 학습 데이터와 다름). Route Handler·폰트·이미지 설정에서 특히 준수.
- **Rationale**: AGENTS.md는 `next dev`가 재생성하는 강제 조항이며 파트1 계획 §4-9에도 명시.

## R-17. 데모 폴백

- **Decision**: 기획 화면 미도착/통합 실패 대비 `simulate.ts` 텍스트 데모 + LLM/TTS 장애 시 고정 대사 폴백 경로를 리허설 체크리스트에 포함.
- **Rationale**: 분담안 일정 Day 2~3 폴백 계획.

## 미해결(기획·팀 회신 대기 — 구현은 잠정값으로 진행 가능)

| # | 항목 | 잠정값 | 회신 주체 |
|---|---|---|---|
| 1 | 'ㅇㅇ' 자리표시자 (R-07) | '친구야' 치환 사전 생성 | 기획 |
| 2 | 고정 오디오 파일명 (R-06) | `key` 기반 | 팀 합의 |
| 3 | post_activity_config (R-09) | 임시 저작 시드 | 기획 |
| 4 | 시스템 안내 문구 | proposal 유지 | 기획 |
| 5 | 보이스 4종 확정 | 후보 샘플→투표 | 팀 투표 |
| 6 | children 스키마 보강 (R-11-2) | avatar_key·birth_date 추가 | 팀(DB SoT) |
| 7 | 헤드라인 폰트 Jua vs Cafe24 | Cafe24Ssurround | 기획 |
