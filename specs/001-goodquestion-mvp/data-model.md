# Data Model: 굿퀘스천 MVP

**Date**: 2026-08-10 · **근거**: Supabase 실스키마(PostgREST OpenAPI 조회, 2026-08-10) + `fixtures/*.json` + 기능명세서 기술 참고란. 스키마 SoT는 Notion 「DB 구조_260803_수정안」 — 아래 "추가 필요" 항목은 팀 공유 후 마이그레이션.

## 1. 기존 테이블 (구축 완료 11종 — 실스키마 확인값)

### parents
| 컬럼 | 비고 |
|---|---|
| id | PK. Supabase `auth.users.id`와 1:1 (research R-10) |
| name | 보호자 표시명 |
| created_at | |

### children
| 컬럼 | 비고 |
|---|---|
| id | PK |
| parent_id | FK → parents. 보호자당 1~3명 (앱 레벨 제한) |
| name | 홈/내정보 표시는 첫 글자(성) 제외 규칙 |
| birth_year | ⚠️ 기능명세서는 생년월일 8자리(만 나이 배지) 요구 — §3 갭 |
| created_at | |

### child_consents
| 컬럼 | 비고 |
|---|---|
| id, child_id | 아동 개인정보 처리 동의 |
| consent_version, verification_method, consented_at, withdrawn_at | 회원가입/프로필 추가 화면의 동의 1회 저장 |

### stories
| 컬럼 | 비고 |
|---|---|
| id, title, summary, difficulty, topics, estimated_minutes, status | 목록·상세·필터(주제/난이도 AND) 데이터 |
| post_activity_config | JSON `{cards:[{id,image_key,label}], answer_order:[], keywords:[]}` — 현재 null, 임시 저작 시드(R-09) |

### story_scenes
| 컬럼 | 비고 |
|---|---|
| id, story_id, scene_order | 순차 진행·다음 장면 = scene_order+1 |
| scene_description | 도입·전개 내레이션 원문 — 온점(.) 분리해 문장 단위 재생 |
| conflict, character_name, character_opening, character_closing | 대화 장면 데이터. closing은 사전 생성 오디오와 1:1 |
| scene_goal, required_elements, preferred_turns, max_turns | 규칙 엔진 입력. preferred_turns는 참고용(R-08) |
| *(없음)* scene_type | ⚠️ §3 갭 — 도입/전개/대화 구분·진행률 계산에 필수 |

### story_sessions
| 컬럼 | 비고 |
|---|---|
| id, child_id, story_id, status, started_at, completed_at, last_activity_at | 세션 수명주기. 완료 시 이어하기 제외 |
| current_scene_id, scene_goal_met | 이어하기 지점 계산: goal_met=true 최신 장면의 scene_order+1, 없으면 scene_order=2 |
| current_child_turn_count, accumulated_elements, last_detected_elements | 규칙 엔진 상태 (누적 요소 유지) |
| last_response_mode, last_guidance_target | NORMAL/GUIDED/CLOSING·유도 대상 |
| turns_without_new_element, consecutive_low_information_turns | 저정보·정체 카운터 |
| scene_end_reason | GOAL_MET / MAX_TURNS |

### messages
| 컬럼 | 비고 |
|---|---|
| id, session_id, scene_id, speaker_type, turn_order | 대화 내역 리스트 원천 (아이/캐릭터 구분) |
| text, stt_raw_text | 교정 확정본/원문 분리. STT 게이트 실패 시 **행 미생성**(턴 카운트 제외) |
| created_at | |

### utterance_analyses
| 컬럼 | 비고 |
|---|---|
| id, message_id | 아이 메시지당 1건 |
| child_intent, main_point, detected_elements, utterance_validity | 4필드 확정본(서버 후처리 후). validity: VALID/SHORT/UNCLEAR/OFF_TOPIC/PLAYFUL |
| analysis_version | 프롬프트/모델 버전 태깅 |
| *(없음)* raw JSON | ⚠️ LLM 원본 병행 저장 권고(연동기준 §2-D) — 컬럼 추가 협의 전까지 서버 로그로 보존(R-11-4) |

### post_activity_results
| 컬럼 | 비고 |
|---|---|
| id, session_id | 세션당 1행 upsert |
| submitted_order, is_order_correct, attempt_count | 2.4.4 카드 배열 — 서버 판정, 시도마다 attempt_count+1 |
| retelling_text, completed_at | 2.4.5 재구성 발화 — 저장 시 학습완료 진입, 재진입 라우팅 키 |

### reports / wordbook
- 보호자 리포트·단어장용 — **이번 범위 제외(P3)**, 스키마만 존재.

## 2. 코드/파일 관리 데이터 (DB 외)

| 데이터 | 위치 | 용도 |
|---|---|---|
| 이야기·장면·미션 콘텐츠 | `fixtures/story.banggui.json` | `seed.ts`의 시드 원천. external_id(`sc_banggui_03`)→uuid 매핑은 시드 시 생성 |
| 미션 정의 (mission_1: 대화3/sc_banggui_07, mission_2: 대화4/sc_banggui_09 — goal·guide_points·expose_conditions·examples) | 동일 파일 `missions` 키 | DB 테이블 신설 대신 서버 설정 로드(R-11-3). 노출 판정 입력 |
| 캐릭터 페르소나 (며느리·시아버지·마을 이장, traits) | `fixtures/characters.banggui.json` | 캐릭터 LLM 시스템 프롬프트 원료 |
| 고정 대사 14건 (오프닝4·클로징4·내레이션5·시스템1, `key`·`voice_role`·`has_name_placeholder`) | `fixtures/tts-lines.banggui.json` | `pregenerate-audio.ts` 입력. 'ㅇㅇ' 2건은 '친구야' 치환(R-07) |
| 캐릭터→voice_id 매핑 (역할 4종: 며느리·시아버지·이장·내레이터) | `src/lib/tts/voice-map.json` (신규, 투표 후 확정) | `synthesize(text, voiceId)` 라우팅 |
| 이미지 키 매핑 | `fixtures/storage-assets.json` | `story-assets` 버킷 public URL 조합 (`base_url+'/'+key`) |
| 게이트 임계값·모델명 | `src/lib/config.ts` + env | `no_speech_prob`/`avg_logprob` 등 실측 튜닝 대상 |

## 3. 스키마 갭과 조치 (**2026-08-10 확정: DB는 Notion 설계서 그대로 — 마이그레이션 없음, 전부 코드 레벨 대체**)

| # | 갭 | 조치 | 차단 화면 |
|---|---|---|---|
| 1 | `story_scenes.scene_type` 없음 | **컬럼 미추가** — fixtures type/label 파생(`src/lib/story.ts` sceneTypeOf). 진행률 N = 전개+대화 쌍=1 카운트(도입 제외) | 없음 (코드로 충족) |
| 2 | `children.avatar_key`·`birth_date` 없음 | **컬럼 미추가·보류** — 생년월일 입력(YYYYMMDD)→birth_year 저장, 만 나이 배지는 연 나이 근사. 아바타 영속화는 Notion 개정 시 재론 | 프로필 화면 일부 범위 조정 |
| 3 | 미션 테이블 없음 | MVP는 fixtures 로드로 대체(신설 보류 — 연동기준 §2-A 방침) | 없음 (서버 설정으로 충족) |
| 4 | `utterance_analyses` raw 컬럼 없음 | 서버 로그 보존으로 대체, 컬럼 추가는 협의 | 없음 (디버깅 편의만 영향) |
| 5 | `element_criteria`/`element_worries` 없음 | **보류 확정**(Notion 요구사항 개정 전까지) — 프롬프트에 scene_goal만 주입 | 없음 |

## 4. Storage 버킷

| 버킷 | 상태 | 내용 |
|---|---|---|
| `story-assets` | ✅ 업로드 완료 | 썸네일·장면 이미지 35종 (`stories/banggui/...` — storage-assets.json 매핑) |
| `fixed-audio` | 신설 | 고정 대사 mp3 14건, 파일명 `{key}.mp3` 잠정(R-06). 공개 읽기 |
| `tts-cache` | 신설 | 런타임 가변 대사 캐시 `hash(voiceId+text).mp3`. 공개 읽기 |

## 5. 상태 전이

### 세션 장면 진행
`도입(항상 처음부터) → 전개n ⇄ 대화n(쌍) → … → 카드 배열(2.4.4) → 재구성(2.4.5) → 완료(2.5)`
- 재진입 라우팅: `completed_at` 존재→2.5 / `is_order_correct=true`→2.4.5 / 그 외→`scene_goal_met` 기준 장면 (도입 미완은 항상 도입 1문장부터).

### 대화 턴 상태머신 (Zustand)
`CHAR_SPEAKING(캐릭터의 말을 듣고 있어요!) → RECORDING(생각을 말해보세요! — 자동 시작, 미션 팝업은 버튼 시작) → TRANSCRIBING(말을 글자로 바꾸는 중이에요!) → REVIEW(텍스트 표시·보내기 활성) → SUBMITTED(라벨 없는 처리 구간) → CHAR_SPEAKING…`
- STT 게이트 실패: `TRANSCRIBING → RECORDING` 복귀(재시도 안내, 메시지 미생성).
- 규칙 엔진 판정: `NORMAL | GUIDED(부족 요소 1~2개 지정) | CLOSING(GOAL_MET·MAX_TURNS·미션 완료)` — CLOSING이면 LLM 미호출, 고정 오디오 재생 후 다음 장면.
