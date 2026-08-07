우리 프로젝트의 발화 분석·진행 판단 아키텍처를 검토하려고 해. 새로 추가된 "발화 분석 및 진행 판단 연동 기준" 문서가, 이전에 설계했던 STT/TTS/LLM 흐름 및 발화 분석(analyze) 설계와 충돌하는 부분이 있는지 봐줘.

이전 설계에서 확정했던 내용은 다음과 같아:

STT: 아이 음성을 텍스트로 변환해 화면 표시. 원본 텍스트는 messages.stt_raw_text에, 확정 텍스트는 messages.text에 저장. 원본 음성 파일은 저장하지 않음. STT 실패 시 메시지 자체를 생성하지 않음(=분석 대상 아님).
TTS: 캐릭터 발화 음성 자동 재생 + 다시 듣기 제공.
발화 분석(analyze) 역할 분담: 분석 LLM은 child_intent, main_point, detected_elements, utterance_validity 네 가지만 제안. 장면 목표 충족 여부와 응답 모드(NORMAL/GUIDED/CLOSING), 종료 이유는 LLM이 아니라 서버 규칙이 story_sessions에서 확정.
누적 상태 관리: accumulated_elements, turns_without_new_element(2연속 시 유도), consecutive_low_information_turns(SHORT/UNCLEAR/OFF_TOPIC 2연속 시 유도) 등으로 유도 판단.
장면 종료(CLOSING) 처리: 이 부분이 이전 자료 안에서도 서로 다르게 적혀 있어서 특히 확인이 필요해. DB 구조 문서에 한쪽에는 "종료 시 서버가 CLOSING 모드를 정하고 캐릭터 LLM이 마무리 대사를 생성한다"고 되어 있고, 다른 쪽(story_scenes, utterance_analyses 참고 노트)에는 "고정 마지막 대사(character_closing)를 두고, CLOSING이면 LLM이 마지막 대사를 생성하지 않고 서버가 character_closing을 조회해 재생"한다고 되어 있어.

새 문서의 핵심 주장은 다음과 같아:

처리 순서: ① 발화 분석 모듈(LLM) → ② 서버 후처리 모듈 → ③ 진행 판단 모듈(규칙 엔진) → ④ 유도 정보 구성 → ⑤ 캐릭터 응답.
분석 모듈 출력은 childIntent, detectedElements, utteranceValidity 3개(이전 설계의 main_point는 명시되지 않음).
CLOSING에서는 캐릭터 모델을 다시 호출하지 않고, 장면 설정에 정의된 종료 처리를 사용한다고 명시.
분석 입력에 elementCriteria(장면별 요소 인정 기준)와 targetElements가 새로 등장하고, 서버 후처리가 evidence 원문 검증·중복 정리·약한 탐지 보정을 담당.
유도는 진행 엔진이 직접 질문 문장을 만들지 않고, 부족한 요소명 + 캐릭터의 remainingWorries 정보를 캐릭터 모델에 넘겨 대사로 표현.

이걸 바탕으로 확인해줘:

새 문서와 이전 설계(MVP 요건·DB 구조) 사이에 실제로 충돌하는 지점이 있는지, 있다면 어디인지.
특히 CLOSING 시 캐릭터 대사 생성 방식(LLM 생성 vs. 고정 character_closing 재생 vs. "장면 설정 종료 처리")이 문서마다 다른데, 어느 쪽으로 통일해야 하는지.
분석 LLM 출력 필드 불일치(이전엔 main_point 포함 4개, 새 문서엔 3개), elementCriteria가 DB의 story_scenes에 저장 필드로 반영돼야 하는지 등 스키마/필드 차원의 불일치.
STT/TTS 흐름과는 충돌 없이 잘 맞물리는지, 아니면 조정이 필요한 부분이 있는지.

충돌이 있는 항목과 없는 항목을 구분해서 정리해줘.