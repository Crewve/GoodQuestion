// src/lib/contracts.ts
//
// ★ 파트1(음성 I/O) ↔ 파트2(대화 두뇌) 공유 계약 타입 — 이 파일 변경은 상호 합의로만 (분담안 공용 규칙)
// 초안: specs/001-goodquestion-mvp/contracts/lib-contracts.md (파트2 작성 → 파트1 승인으로 확정)
//
// 불변 조건:
// 1. `failed: true`인 SttResult는 어떤 경로로도 messages 행이 되지 않는다 (턴 카운트 제외).
// 2. AnalysisResult.detectedElements[].evidence는 아이 발화 원문의 부분 문자열이어야 하며,
//    위반 시 서버 후처리가 해당 탐지를 제거·보정한다 (LLM 원본은 raw로 보존).
// 3. ProgressDecision은 story_sessions 상태(accumulated/카운터)와 장면 데이터(required_elements·
//    max_turns·미션 정의)만으로 결정된다 — LLM 출력이 판단을 직접 결정하지 않는다.
// 4. camelCase(API/코드) ↔ snake_case(DB 컬럼) 매핑은 저장 경계에서만 수행한다 (연동기준 §1-6).

/** 8가지 사고 요소 — 분석 LLM은 항상 전체를 탐지 대상으로 한다 (연동기준 §2-C) */
export type ThinkingElement =
  | 'DECISION' | 'EMOTION' | 'REASON' | 'PERSPECTIVE'
  | 'EMPATHY' | 'SOLUTION' | 'RESULT' | 'REQUEST';
// 허용값 목록은 fixtures 8요소 정의를 따른다. 대화1의 EXPRESSION은 REASON 오기로 처리(R-08).

/** 접점 ① 파트1 → 파트2: STT 결과 */
export type SttResult = {
  text: string;        // 경량 교정 확정본 (교정 실패 시 sttRawText 폴백)
  sttRawText: string;  // Whisper 원문
  failed: boolean;     // 실패 게이트 판정 — true면 메시지 미생성·턴 카운트 제외 (처리는 서버 조립부 책임)
};

/** 파트2 내부: 분석 LLM 구조화 출력 (4필드 required — 연동기준 §2-B) */
export type AnalysisResult = {
  childIntent: string;
  mainPoint: string;
  detectedElements: { type: ThinkingElement; evidence: string }[]; // evidence는 발화 원문 인용
  utteranceValidity: 'VALID' | 'SHORT' | 'UNCLEAR' | 'OFF_TOPIC' | 'PLAYFUL';
};

/** 파트2 내부: 규칙 엔진 판정 (순수 함수 출력 — 문장 미생성) */
export type ProgressDecision = {
  mode: 'NORMAL' | 'GUIDED' | 'CLOSING';
  missingElements: ThinkingElement[];
  guidanceTarget?: ThinkingElement;              // GUIDED 시 유도 대상 (최대 1~2개)
  sceneEndReason?: 'GOAL_MET' | 'MAX_TURNS';    // CLOSING 시 확정
};

/** 접점 ② 파트2 → 파트1: 캐릭터 응답 텍스트 → 음성 합성 */
// characterReplyText: string 을 synthesize(characterReplyText, voiceId) 에 전달.
// 단, mode==='CLOSING'이면 synthesize를 호출하지 않고 사전 생성 mp3(fixed-audio)를 재생한다 (연동기준 §2-A 확정).
export type SynthesizeFn = (text: string, voiceId: string) => Promise<Buffer>; // mp3
