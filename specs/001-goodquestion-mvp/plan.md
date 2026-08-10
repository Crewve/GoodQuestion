# Implementation Plan: 굿퀘스천 MVP — 아동 음성대화 학습 서비스

**Branch**: `001-goodquestion-mvp` | **Date**: 2026-08-10 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-goodquestion-mvp/spec.md` (docs/·design/·fixtures/ 산출물에서 도출)

## Summary

아이가 「방귀 뀌는 며느리」 동화 캐릭터와 음성으로 대화하며 사고 요소 8종을 표현하도록 돕는 태블릿 웹 서비스. 핵심 파이프라인은 **녹음 → Whisper STT(실패 게이트+경량 교정) → 분석 LLM(4필드 구조화 출력) → 서버 후처리 → 규칙 엔진(순수 코드, NORMAL/GUIDED/CLOSING 판정) → 캐릭터 LLM 또는 고정 대사 → 타입캐스트 TTS(캐시) → 재생**이며, 판단은 코드·LLM은 분석/생성만 담당한다. Next.js 16.3 단일 레포 풀스택으로, Supabase(스키마 11테이블 구축 완료·이미지 업로드 완료)를 DB/Storage로 사용한다. 2인 분담(파트1=음성 I/O, 파트2=대화 두뇌)이 각자 CLI로 단독 검증 후, 화면(기능명세서 3영역: 진입·이야기·마이페이지)을 공동 조립한다.

## Technical Context

**Language/Version**: TypeScript 5 (strict) / Node.js 20 / React 19.2.8

**Primary Dependencies**: Next.js 16.3.0 (App Router, Turbopack — **코드 작성 전 `node_modules/next/dist/docs/` 필독**, AGENTS.md), Tailwind CSS 4, `openai`(Whisper `whisper-1` + `gpt-4o-mini`), 타입캐스트 TTS REST, `@supabase/supabase-js`(+`@supabase/ssr`), Zustand(턴 상태머신), `tsx`(CLI 스크립트), Vitest(순수 함수 테스트)

**Storage**: Supabase Postgres(구축 완료 11테이블 — research.md R-11) + Storage 버킷 `story-assets`(업로드 완료)·`fixed-audio`(신설)·`tts-cache`(신설). 원본 음성은 어디에도 저장하지 않음(즉시 폐기)

**Testing**: Vitest(규칙 엔진·STT 게이트 순수 함수) + CLI 검증 스크립트(`stt-check`/`tts-check`/`pregenerate-audio`/`simulate`) + eval 골든 세트 20~30건

**Target Platform**: 태블릿 가로(1194×834 시안 기준) 우선 웹 — PC·모바일 가로 반응형 대응, Vercel(icn1)+Supabase(ap-northeast-2) 배포 예정

**Project Type**: Next.js 풀스택 단일 레포 (web-service + CLI 검증 도구)

**Performance Goals**: 대화 턴 왕복(녹음 종료→응답 재생 시작) 통상 10초 이내(잠정), 고정 대사 재생은 LLM/TTS 무관 즉시

**Constraints**: 타입캐스트 무료 한도(월 3만 자·동시 호출 2·출처 표기 의무), OpenAI/타입캐스트/service role 키 서버 전용(클라이언트 비노출), 원본 음성 미저장, CLOSING 시 캐릭터 LLM 미호출(2026-08-07 확정), 콘텐츠 하드코딩 금지(fixtures→DB 시드), 마감 8/11~12(잔여 1~2일)

**Scale/Scope**: 이야기 1편(장면 9: 내레이션 5+대화 4, 미션 2, 고정 대사 14건), 화면 약 20종(기능명세서 1.x~3.x), 동시 사용자 = 시연 수준(수 명)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`는 미작성 템플릿 상태(원칙 미비준)로 **강제 게이트 없음**. 대신 프로젝트 문서에서 확정된 아래 원칙을 게이트로 준용하며, 본 플랜은 전부 준수한다:

| 준용 원칙 (출처) | 상태 |
|---|---|
| 판단=코드, LLM=분석·생성만 — 규칙 엔진은 문장 미생성 (분담안·연동기준 §1-3) | ✅ `src/lib/rules/` 순수 함수 설계 |
| CLOSING은 고정 `character_closing` 재생, LLM 미호출 (연동기준 §2-A 확정) | ✅ R-04 |
| 원본 음성 즉시 폐기·미저장 (분담안) | ✅ R-02, FR-008 |
| API 키 서버 전용 (디렉토리 명세 §4) | ✅ Route Handler 경유만 |
| 콘텐츠 하드코딩 금지, fixtures→DB 시드 (분담안 공용 규칙) | ✅ R-08 |
| 각 파트 CLI 단독 검증 가능 (분담 원칙) | ✅ R-13 |
| 공유 파일(`contracts.ts`·`fixtures/`) 변경은 상호 합의 (분담안) | ✅ 계약 문서화(contracts/) |

*Post-design 재점검(Phase 1 완료 후)*: 위반 없음 — data-model.md는 기존 스키마를 그대로 쓰고 추가분(scene_type 등)은 팀 합의 항목으로 표기, contracts/는 텍스트 2접점 원칙을 유지.

> 권고: 추후 `/speckit-constitution`으로 위 준용 원칙을 정식 헌법으로 비준.

## Project Structure

### Documentation (this feature)

```text
specs/001-goodquestion-mvp/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output — 결정 17건 + 미해결 7건
├── data-model.md        # Phase 1 output — 실스키마 11테이블 + 갭·시드 매핑
├── quickstart.md        # Phase 1 output — 검증 시나리오 (CLI→E2E)
├── contracts/           # Phase 1 output
│   ├── lib-contracts.md # 파트1↔파트2 코드 계약 (src/lib/contracts.ts 초안)
│   └── api-routes.md    # HTTP API 계약 (/api/stt, /api/turn, /api/post-activity 등)
└── tasks.md             # Phase 2 output (/speckit-tasks — 본 명령이 생성하지 않음)
```

### Source Code (repository root)

```text
GoodQuestion/
├── src/
│   ├── app/
│   │   ├── layout.tsx                  # 루트 레이아웃 — next/font/local(src/fonts), 오디오 언락 Provider
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx          # 1.1 이메일/소셜 로그인 (Supabase Auth)
│   │   │   └── signup/page.tsx         # 1.2 계정 생성 → 아이 등록 (2단계 인디케이터)
│   │   ├── profiles/page.tsx           # 2.1 아이 프로필 선택 · 2.1.1 추가
│   │   ├── home/page.tsx               # 2.0 홈 — 이어하기 + 추천 6개(첫 카드 고정)
│   │   ├── stories/
│   │   │   ├── page.tsx                # 2.2 이야기 목록 (주제·난이도 AND 필터)
│   │   │   └── [storyId]/page.tsx      # 2.3 이야기 상세
│   │   ├── play/[sessionId]/page.tsx   # 2.4 이야기 진행 — 도입/전개/대화/미션/학습완료 단계 렌더
│   │   ├── complete/[sessionId]/page.tsx # 2.5 학습 완료
│   │   ├── my/                         # 3.x 마이페이지 (내정보/프로필 관리/공지/고객센터/이용안내/배지)
│   │   └── api/
│   │       ├── stt/route.ts            # POST 오디오+장면 힌트 → SttResult
│   │       ├── turn/route.ts           # POST 확정 텍스트 → 저장→분석→규칙→생성/고정→TTS → 턴 응답
│   │       ├── sessions/route.ts       # POST 세션 시작/재개 지점 계산
│   │       └── post-activity/route.ts  # POST 카드 순서 판정 · 재구성 저장
│   ├── lib/
│   │   ├── contracts.ts                # ★ 파트1↔파트2 공유 타입 (변경은 상호 합의)
│   │   ├── openai.ts                   # OpenAI 단일 클라이언트
│   │   ├── supabase.ts                 # 서버 전용 service role 클라이언트
│   │   ├── config.ts                   # 역할별 모델·게이트 임계값 설정 로더
│   │   ├── stt/                        # [파트1] 힌트 구성·게이트(순수 함수)·경량 교정
│   │   ├── tts/                        # [파트1] 타입캐스트 어댑터·동시성 2 큐·2층 캐시·voice-map.json
│   │   ├── llm/                        # [파트2] 분석·생성 호출부 + 구조화 출력 스키마(4필드)
│   │   ├── rules/                      # [파트2] 규칙 엔진 순수 함수 + *.test.ts (Vitest)
│   │   └── missions.ts                 # [파트2] 미션 노출 판정 입력(fixtures expose_conditions 로드)
│   ├── components/                     # 대화 카드·상태 배지·진행률 바·미션 팝업·카드 DnD 등
│   ├── store/                          # Zustand 턴 상태머신 (듣는중/말하는중/변환중/대기)
│   ├── hooks/                          # useRecorder(MediaRecorder+RMS 게이트), useAudioUnlock
│   └── fonts/                          # (기존) PretendardGOV 서브셋 4 + Cafe24Ssurround woff2
├── scripts/
│   ├── tts-voices.ts                   # [파트1] 보이스 후보 샘플 생성 → 팀 투표
│   ├── pregenerate-audio.ts            # [파트1] 고정 대사 14건 → mp3 → fixed-audio 업로드 (멱등)
│   ├── stt-check.ts / tts-check.ts     # [파트1] 왕복 검증·게이트 임계 튜닝
│   ├── simulate.ts                     # [파트2] 대본→분석→규칙→응답 텍스트 시뮬레이션
│   ├── seed.ts                         # fixtures → DB 시드 (external_id→uuid 매핑)
│   └── upload_story_assets.py          # (기존) design/이미지 → story-assets 업로드
├── eval/                               # [파트2] 골든 케이스 20~30건 + 회귀 러너
├── fixtures/                           # (기존) story·characters·tts-lines·storage-assets JSON
└── supabase/                           # (선택) 추가 마이그레이션 sql — scene_type 등 팀 합의분
```

**Structure Decision**: `프로젝트_디렉토리_명세.md` §3 확장 예정 구조를 채택·구체화. 계약 타입은 `src/lib/contracts.ts`(`@/` 별칭) — 분담안 표기(`lib/server/…`)와의 경로 불일치는 디렉토리 명세 기준으로 해소(파트1 계획 §6 권고). 파트1·파트2 소유 모듈을 디렉토리로 분리해 같은 파일을 수정할 일이 없게 유지.

## 구현 단계 개요 (tasks.md 생성 시 기준)

일정 제약(잔여 1~2일)에 맞춘 크리티컬 패스 순:

1. **Day 0 잔여 (8/10)** — 선행·차단 해소: 타입캐스트 가입·보이스 후보 샘플(`tts-voices`)→투표 요청(리드타임 크리티컬), `contracts.ts` 초안 합의, 의존성 추가·`.env.example`, TTS 어댑터+캐시+`tts-check`, STT 어댑터(게이트 순수 함수)+`stt-check` — 파트1 계획 §4 그대로.
2. **파트2 병렬**: 분석 프롬프트+구조화 출력, 서버 후처리, 규칙 엔진+Vitest, 캐릭터 프롬프트+후검증, eval 세트, `simulate.ts`.
3. **8/11**: 보이스 확정→voice-map→`pregenerate-audio` 실행·업로드, 아동 발화 근사 샘플로 게이트 임계 튜닝, `SttResult` 전달 선언. `seed.ts`로 DB 시드(scene_type 등 합의분 마이그레이션 포함).
4. **8/11~12 공동 조립**: `/api/stt`·`/api/turn`·`/api/sessions`·`/api/post-activity` Route Handler(**Next 16.3 문서 필독 후**), 화면 조립 — 우선순위: 대화 화면(US1·US2) → 진입 여정(US3) → 학습완료(US4) → 마이페이지(US5). 통합 리허설: 장애 폴백·무료 한도·출처 표기.

## Complexity Tracking

> Constitution 게이트 위반 없음 — 해당 없음. (준용 원칙 대비 예외 0건)
