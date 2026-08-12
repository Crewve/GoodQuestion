# fixtures — 굿퀘스천 확정 콘텐츠 (노션 추출)

노션 기획 문서에서 추출한 확정 콘텐츠. **요구사항 SoT는 노션**이므로 노션이 갱신되면 이 폴더를 다시 추출한다 (`scripts/notion_dump.py` 사용, 추출일: 2026-08-08).

## 원본 노션 페이지

| 문서 | ID | 용도 |
|---|---|---|
| [MVP 콘텐츠) 방귀 뀌는 며느리](https://dour-lamprey-1bc.notion.site/3a50bb61d7ff8015a06ec4239a32f23a) | `3a50bb61-d7ff-8015-a06e-c4239a32f23a` | 장면·대사·미션 원본 |
| [[방뀌며] 캐릭터 성격](https://dour-lamprey-1bc.notion.site/fbd0bb61d7ff8350941d813005093f0c) | `fbd0bb61-d7ff-8350-941d-813005093f0c` | 캐릭터 페르소나 원본 |
| [DB 구조_260803_수정안](https://dour-lamprey-1bc.notion.site/3b10bb61d7ff8092965de6bdef7e096c) | `3b10bb61-d7ff-8092-965d-e6bdef7e096c` | 스키마 SoT (fixtures 아님, raw만 보관) |
| [굿퀘스천 세부 자료 (허브)](https://dour-lamprey-1bc.notion.site/3a50bb61d7ff80fdbbb5c522b4880e12) | `3a50bb61-d7ff-80fd-bbb5-c522b4880e12` | 문서 목록 |

## 파일

- **`story.banggui.json`** — 이야기 메타 + 장면 9개(내레이션 5 + 대화 4) + 미션 2개 + 공통 진행 규칙. DB 시드(`stories`/`story_scenes`)와 규칙 엔진·프롬프트 입력의 원천.
- **`characters.banggui.json`** — 캐릭터 3명(며느리·시아버지·마을 이장) 성격. 캐릭터 LLM 페르소나 프롬프트 원료.
- **`tts-lines.banggui.json`** — TTS 사전 생성 대상 고정 대사 14건(오프닝 4·클로징 4·내레이션 5·시스템 1). 파트 1 pregenerate 스크립트 입력.
- **`raw/`** — 노션 페이지 원문 덤프(텍스트). 재추출 없이 원문 대조할 때 사용.

## ID 규칙

`external_id`(예: `sc_banggui_03`, `ch_banggui_father_in_law`)는 노션 문서의 슬러그를 그대로 보존한 값. 실제 DB 컬럼은 uuid 타입이므로 **시드 스크립트가 uuid를 생성하고 external_id는 매핑용으로만** 쓴다.

## ⚠️ 기획 확인 필요 (추출 중 발견한 불일치)

| # | 항목 | 내용 | 임시 채택 |
|---|---|---|---|
| 1 | 대화2 required_elements | 장면 테이블 `[PERSPECTIVE, EMOTION, REASON, SOLUTION]` vs 화면 흐름 `[PERSPECTIVE, EMPATHY, REASON, REQUEST]` — 진짜 충돌 | 장면 테이블(DB 매핑 기준) |
| 2 | 대화1 요소의 `EXPRESSION` | 화면 흐름에만 등장, 8요소 허용값 아님 (REASON 오기 추정) | 장면 테이블의 `REASON` |
| 3 | `preferred_turns` | DB 스키마상 필수인데 콘텐츠 문서에 값 없음 | `null` — 시드 시 기본값 필요 |
| 4 | `post_activity_config` | 이 이야기의 카드·정답 순서·재구성 키워드 미정의 | 전개1~4 이미지 재사용 카드 4장+정답 순서+키워드 4개 임시 저작 (R-09/T051, story.banggui.json) |
| 5 | 'ㅇㅇ' 자리표시자 | 대화1·대화4 오프닝에 아이 이름 포함 → 사전 생성 TTS와 충돌 | 미정 — 치환/런타임TTS 중 결정 |
| 6 | 대화3 첫 대사 어미 | '없었소'(장면 테이블) vs '없었단다'(화면 흐름) | 장면 테이블 |
| 7 | 시스템 대사 | STT 재시도 등 시스템 안내 문구가 기획 원문에 없음 | 제안 문구로 임시 (`source: "proposal"`) |

참고: DB 구조 문서 §5 참고 절의 "character_closing을 두지 않는다 / CLOSING 시 LLM이 마무리 대사 생성" 서술은 구버전 잔재로 확인됨(2026-08-07 확정: **고정 `character_closing` 재생**). 콘텐츠 문서의 고정 클로징 대사가 이 확정과 정합.

## 재추출 방법

```bash
python scripts/notion_dump.py <notion_page_id>   # 공개 페이지 내부 API로 전체 블록 덤프
```
