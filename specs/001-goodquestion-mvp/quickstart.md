# Quickstart: 굿퀘스천 MVP 검증 가이드

구현이 아니라 **동작 증명** 순서다. 분담 원칙대로 UI 없이 CLI부터 검증하고, 화면 조립 후 E2E 데모 시나리오로 마감한다. 상세 계약은 [contracts/](./contracts/), 데이터는 [data-model.md](./data-model.md) 참조.

## 0. 사전 조건

- Node.js 20, npm. 의존성 추가: `openai @supabase/supabase-js @supabase/ssr zustand` + dev `tsx vitest`
- `.env.local` (커밋 금지) — `.env.example` 갱신 유지:

```bash
OPENAI_API_KEY=            # Whisper + gpt-4o-mini 공용 (팀 1키)
TYPECAST_API_KEY=          # 타입캐스트 (가입 후 발급 — Day 0 선행)
NEXT_PUBLIC_SUPABASE_URL=https://lpiqyaqajlxhnvumvjvb.supabase.co
SUPABASE_SERVICE_ROLE_KEY= # 기존 보유 (서버 전용)
# 선택 오버라이드: ANALYSIS_MODEL / GENERATION_MODEL / STT_CORRECTION_MODEL (기본 gpt-4o-mini)
```

- Supabase: `story-assets` 버킷 업로드 완료 상태 확인, `fixed-audio`·`tts-cache` 버킷 생성(공개 읽기).

## 1. 파트1 — 음성 I/O 단독 검증 (CLI)

```bash
npx tsx scripts/tts-voices.ts            # 보이스 후보 샘플 mp3 생성 → 팀 투표 (크리티컬 패스 선행)
npx tsx scripts/tts-check.ts "안녕, 나는 며느리야" --role daughter_in_law
                                         # 기대: mp3 저장·재생 가능, 2회째는 캐시 히트(재합성 없음)
npx tsx scripts/stt-check.ts sample.m4a --scene sc_banggui_03
                                         # 기대: SttResult + 게이트 신호 5종 전부 출력 (임계 튜닝용)
npx tsx scripts/stt-check.ts silence.webm --scene sc_banggui_03
                                         # 기대: failed=true (무음/환각 차단)
npx tsx scripts/pregenerate-audio.ts     # 고정 대사 14건 → fixed-audio 업로드. 재실행 시 전건 스킵(멱등)
```

**통과 기준**: iPad `audio/mp4`·안드로이드 `webm/opus` 양쪽 입력 확인, 아동 발화 근사 샘플 10~20건으로 게이트 오탐/미탐 튜닝, 'ㅇㅇ' 2건은 '친구야' 치환본 생성 확인, 타입캐스트 사용량 잔여 확인(월 3만 자).

## 2. 파트2 — 대화 두뇌 단독 검증 (CLI)

```bash
npx vitest run src/lib                   # 규칙 엔진(누적·모드·종료)·STT 게이트 순수 함수
npx tsx scripts/simulate.ts scripts/scenarios/happy-path.json
                                         # 대본(아이 발화 시퀀스) → 분석→후처리→판정→응답 전체 루프 텍스트 출력
npx tsx eval/run.ts                      # 골든 케이스 20~30건 탐지 정확도 — 프롬프트 수정 때마다 회귀
```

**통과 기준**: ①요소 누적이 여러 턴에 걸쳐 유지 ②GUIDED가 부족 요소 1~2개만 유도 ③CLOSING에서 캐릭터 LLM 미호출 ④미션 노출 조건 4종 시나리오 판정 ⑤evidence 원문 인용 위반이 후처리에서 제거.

## 3. 시드·통합

```bash
npx tsx scripts/seed.ts                  # fixtures → stories/story_scenes (external_id→uuid 매핑, 임시 채택값 R-08 반영)
npm run dev                              # http://localhost:3000 — Next 16.3 문서 필독 후 Route Handler 조립
```

API 스모크 (curl 또는 REST 클라이언트):

1. `POST /api/sessions` → resumeSceneId·scenes·progress 반환
2. `POST /api/stt` (샘플 오디오) → `SttResult`
3. `POST /api/turn` (확정 텍스트) → mode·characterReplyText·audioUrl — 같은 텍스트 재호출 시 TTS 캐시 히트
4. required 충족 시퀀스 전송 → 마지막 응답 `mode: 'CLOSING'` + fixed-audio URL
5. `POST /api/post-activity` 카드 오답→정답→재구성 → `post_activity_results` 행 확인

## 4. E2E 데모 시나리오 (제출 전 리허설)

1. 회원가입(이메일) → 아이 등록(캐릭터·이름·생년월일) → 프로필 선택 → 홈
2. 추천 첫 카드 '방귀 뀌는 며느리' → 상세 → 시작하기 → 도입(문장 자동 재생·화살표)
3. 대화1: 상태 배지 3종 전환, 마이크 자동 시작, 보내기 → 캐릭터 응답 재생
4. 대화3: 미션1 오버레이 노출 → 음성 응답 → 성공 완료 → 대화 복귀
5. 최대 턴 도달 케이스 1회(평가·지적 없는 클로징 확인)
6. 카드 배열(오답 1회 포함) → 재구성 발화 → 학습 완료 화면 → 홈 이어하기에서 제외 확인
7. 중단·재개: 대화 중 X 나가기 → 상세 → 시작하기 → 마지막 지점 재개
8. 장애 폴백: TTS 키 제거 상태에서 CLOSING 재생됨 확인, **타입캐스트 출처 표기 노출 확인**

## 5. 완료 체크리스트

- [ ] 원본 음성이 서버·Storage·DB 어디에도 없음 (업로드 임시 파일 포함)
- [ ] 클라이언트 번들에 API 키 3종 미포함 (`next build` 후 검색)
- [ ] 게이트 임계값이 config로 분리되어 재배포 없이 튜닝 가능
- [ ] `contracts.ts`·`fixtures/` 변경 이력에 상호 합의 기록
- [ ] 기획 미확정 7건(research.md 미해결 표)이 데이터 교체만으로 반영 가능한 구조인지 확인
