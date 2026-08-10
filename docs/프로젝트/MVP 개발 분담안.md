# 굿퀘스천 MVP 개발 분담안

작성일: 2026-08-08 · 마감: 3~4일 후 · 2인 분담 · 스택: Next.js 풀스택 (단일 레포)

> 이 파일은 공유용 사본. 원본: `C:\Knowledge Base\Projects\굿퀘스천\Specs\MVP 개발 분담안.md` (수정은 원본에)

## 전제

- 기획의 **화면 디자인·시퀀스 문서는 미도착** (도착 예정) → 프론트엔드 UI 작업은 보류.
- **대사·장면·캐릭터 콘텐츠는 확정** — 노션에서 추출해 `C:\hackathon\fixtures\`에 정리 완료 (story/characters/tts-lines JSON + 원문 raw).
- 모델 확정: STT=Whisper API, 분석·생성 LLM=gpt-4o-mini, TTS=타입캐스트 ([[Decision Log]]).
- Supabase 스키마 구축 완료 (핵심 9테이블, Notion 「DB 구조_260803_수정안」과 1:1).
- 따라서 지금 착수 가능한 일 = **AI 파이프라인을 콘텐츠로 미리 완성·튜닝**해 두는 것. 화면·시퀀스 도착 후 API Routes 조립은 공동 작업.

## 분담 원칙

- 각자 에이전트(Claude Code)에게 파트를 통째로 맡길 수 있도록 **큰 단위 2분할**.
- 두 파트의 접점은 **텍스트 2곳뿐**: ① STT 출력 텍스트 → 분석 입력 ② 캐릭터 응답 텍스트 → TTS 입력. 같은 파일을 수정할 일이 없다.
- 각 파트는 프론트 없이 **CLI 스크립트만으로 단독 검증** 가능해야 한다.

## 파트 1 — 음성 I/O (팀원)

STT·TTS 모듈과 고정 대사 오디오 자산 생성.

### 범위·산출물

| 산출물 | 내용 |
|---|---|
| `lib/server/stt.ts` | Whisper API 어댑터. 실패 게이트(최소 길이·무음 RMS·`no_speech_prob`/`avg_logprob`), `stt_raw_text`/`text` 분리, 경량 LLM 후처리 교정 |
| `lib/server/tts.ts` | 타입캐스트 어댑터 `synthesize(text, voice_id)`. `hash(캐릭터+텍스트)` 캐시, 백엔드 프록시 전제 |
| 캐릭터→voice_id 매핑 | 며느리·시아버지·마을 이장 + 내레이터. 보이스 후보 2~3개씩 샘플 생성 → 팀 투표로 확정 |
| `scripts/pregenerate-audio.ts` | `fixtures/tts-lines.banggui.json`(고정 대사 14건) → mp3 일괄 생성·저장 |
| 검증 스크립트 | 녹음 파일→텍스트, 텍스트→mp3 왕복을 CLI로 확인. 아동 발화 근사 샘플(직접 녹음)로 게이트 임계 1차 튜닝 |

### 주의

- 타입캐스트 무료 플랜: 월 3만 자·동시 호출 2·출처 표기 조건 ([[Decision Log]] 2026-08-05 TTS 항목).
- 오프닝 2건에 'ㅇㅇ'(아이 이름) 자리표시자 포함 → 사전 생성 불가. 처리 방식(호칭 치환 vs 해당 대사만 런타임 TTS) 팀 결정 필요.
- 원본 음성 미저장 요건: 변환 후 즉시 폐기.

## 파트 2 — 대화 두뇌 (사용자)

분석 LLM·규칙 엔진·캐릭터 LLM과 품질 검증 체계.

### 범위·산출물

| 산출물 | 내용 |
|---|---|
| 분석 프롬프트 + structured output | 4필드 스키마(`child_intent`/`main_point`/`detected_elements[{type, evidence}]`/`utterance_validity`). 탐지는 항상 8요소 전체 |
| 서버 후처리 | evidence 원문 인용 검증·중복 정리·약한 탐지 보정. LLM 원본과 확정본 구분 유지 |
| `lib/server/rules.ts` 규칙 엔진 | accumulated/missing 계산, `turns_without_new_element`·`consecutive_low_information_turns` 카운트, NORMAL/GUIDED/CLOSING 판정, 종료 이유 확정. 순수 코드 — LLM 무관 |
| 캐릭터 생성 프롬프트 | `fixtures/characters.banggui.json` 페르소나 반영, GUIDED 시 서버 지정 부족 요소 1~2개만 유도, 아동 안전 가드레일 + 후검증(길이·금칙어) |
| eval 세트 | 모의 아동 발화 20~30개에 요소 라벨 부착한 골든 케이스. 프롬프트 수정 때마다 탐지 정확도 회귀 확인 |
| `scripts/simulate.ts` | 대본(아이 발화 시퀀스) 입력 → 분석→후처리→판단→응답 전체 루프를 텍스트로 시뮬레이션하는 CLI |

### 주의

- CLOSING은 캐릭터 LLM 미호출 — `character_closing` 고정 재생이 확정 요구사항 ([[Decision Log]] 2026-08-07).
- 판단=코드, LLM=분석·생성만. 규칙 엔진이 문장을 만들지 않는다.
- 미션 노출 판단(대화3·대화4)은 `fixtures/story.banggui.json`의 `expose_conditions`를 규칙 엔진 입력으로 사용.

## 모듈 인터페이스 (계약)

`lib/contracts.ts`에 타입으로 확정하고 변경은 상호 합의로만. 초안:

```ts
// 파트 1 → 파트 2
type SttResult = { text: string; sttRawText: string; failed: boolean };

// 파트 2 내부 (분석 → 규칙)
type AnalysisResult = {
  childIntent: string; mainPoint: string;
  detectedElements: { type: ThinkingElement; evidence: string }[];
  utteranceValidity: 'VALID' | 'SHORT' | 'UNCLEAR' | 'OFF_TOPIC' | 'PLAYFUL';
};
type ProgressDecision = {
  mode: 'NORMAL' | 'GUIDED' | 'CLOSING';
  missingElements: ThinkingElement[]; guidanceTarget?: ThinkingElement;
  sceneEndReason?: 'GOAL_MET' | 'MAX_TURNS';
};

// 파트 2 → 파트 1
// characterReplyText: string → synthesize(characterReplyText, voiceId)
```

## 공용 규칙

- 레포: Next.js 단일 레포. 파트 1 = `lib/server/stt.ts`·`tts.ts`·`scripts/pregenerate-audio.ts`, 파트 2 = `lib/server/analysis*`·`rules.ts`·`generate*`·`prompts/`·`eval/`·`scripts/simulate.ts`. 공유 = `lib/contracts.ts`·`fixtures/` (공유 파일 변경은 합의 후).
- API 키: OpenAI(Whisper+LLM) 1개, 타입캐스트 1개. `.env.local`, 커밋 금지.
- 콘텐츠는 코드에 하드코딩하지 않고 `fixtures/` → DB 시드 경유. 기획 수정 시 데이터만 교체.

## 일정 (마감 3~4일 기준)

| 시점 | 내용 |
|---|---|
| Day 0 (오늘) | 레포 생성, `contracts.ts` 합의, 파트별 착수. 파트 1: 보이스 후보 샘플 우선(팀 투표 리드타임) |
| Day 1~2 | 파트 병렬 개발·단독 검증. 파트 2: eval 세트로 프롬프트 튜닝 반복 |
| Day 2~3 | 기획 화면·시퀀스 도착 시: API Routes + 프론트 조립(공동). 미도착 시: 시뮬레이션 CLI 데모 폴백 준비 |
| 제출 전 | 통합 리허설, LLM 장애 폴백(고정 대사) 점검, 무료 플랜 조건·요금 재확인 |

## 기획 확인 요청 목록

`C:\hackathon\fixtures\README.md`의 불일치 표가 원본. 요약:

1. **대화2 required_elements 충돌** — 장면 테이블 `[PERSPECTIVE, EMOTION, REASON, SOLUTION]` vs 화면 흐름 `[PERSPECTIVE, EMPATHY, REASON, REQUEST]`
2. 대화1의 `EXPRESSION` — 8요소 허용값 아님 (REASON 오기 추정)
3. `preferred_turns` 값 미정의 (DB 필수 컬럼)
4. 이 이야기의 `post_activity_config`(카드·정답 순서·재구성 키워드) 미정의
5. 'ㅇㅇ' 자리표시자 처리 방식
6. 시스템 안내 문구(STT 재시도 등) 미확정
7. DB 문서 §5 참고 절의 CLOSING LLM 생성 서술 1줄 삭제 (기확정 사항의 문서 정리)

## 관련 문서

[[굿퀘스천 Overview]] · [[Decision Log]] · [[2026-08 Devlog]] · 작업 폴더 `C:\hackathon\fixtures\README.md`(콘텐츠 출처·불일치 상세) · `연동기준_충돌검토.md`(파이프라인 5단계 정합 검토)
