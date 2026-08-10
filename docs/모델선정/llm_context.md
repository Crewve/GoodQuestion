# 프로젝트: 굿퀘스천 - 아동 음성대화 학습 서비스 중간 LLM/아키텍처 선정

## 목적

해커톤 제출용 MVP. 최소비용/최소개발 우선. 실서비스 아님.\
아이 발화를 분석(감정 포함)하고, 부족한 목표 요소를 유도하는 캐릭터 가변 질문을 생성.

## 중간 파트 역할 분해 (자료 근거)

1. 발화 분석 LLM: 입력=아이 확정 텍스트. 출력 JSON=child_intent, main_point, detected_elements(사고요소+근거), utterance_validity(VALID/SHORT/UNCLEAR/OFF_TOPIC/PLAYFUL). "감정분석"=EMOTION 요소 추출.
2. 캐릭터 대화 생성 LLM: 캐릭터 페르소나 유지하며 부족 요소 유도하는 가변 질문 생성(GUIDED). 캐릭터 예: 방귀쟁이 며느리/시아버지/마을 이장. 아동 안전 필수.
3. 서버 규칙(LLM 아님): missing_elements=required_elements−accumulated_elements 계산, 턴 카운트, 저정보 연속 판정, 응답모드(NORMAL/GUIDED/CLOSING)·장면목표충족·종료이유 확정.\
   ※ 자료 명시: 판단은 서버 규칙, LLM은 분석·생성만.

## 사고 요소 집합

DECISION, REASON, PERSPECTIVE, SOLUTION, RESULT, EMOTION, EMPATHY, REQUEST

## 평가 축

역할 통합 vs 분리 / 구조화 출력(JSON) 안정성 / 한국어 품질 / 지연시간 / 비용 / 아동 안전·캐릭터 일관성

## 후보 (역할별 분배 전략)

- 발화 분석(소형·저가): gpt-4o-mini, gpt-4.1-mini, Claude Haiku, Gemini Flash. structured output 안정, 호출 단가 낮음.
- 캐릭터 생성(중급): gpt-4o/4.1, Claude Sonnet, Gemini Pro. 톤·창의성. 단, 서버가 부족요소를 지정해줘 프롬프트 제약이 강함.
- 통합안(단순화): gpt-4o-mini 하나로 분석+생성, 프롬프트만 분리. 개발 최단·비용 최저. 품질 아쉬우면 생성만 상위 모델.
- 오픈소스(프라이버시): Qwen2.5/HyperCLOVA X/Llama3 한국어 계열 자체서버. JSON안정·운영부담으로 해커톤 후순위.

## 오케스트레이션 아키텍처 (한 턴)

STT 확정텍스트 → 분석 LLM(JSON) → utterance_analyses 저장 → 서버규칙(accumulated 갱신·missing 계산·모드결정)\
→ CLOSING이면 character_closing 고정대사 재생 / GUIDED·NORMAL이면 생성 LLM이 부족요소 유도 질문 생성 → TTS 출력.\
핵심: 판단=코드, LLM=분석·생성만 (비용·시연 안정성).

## 결론

분석=gpt-4o-mini(또는 동급 소형), 생성=gpt-4o(또는 통합 시 mini 단일), 판단=서버 코드. 하이브리드가 최소비용·최고안정.