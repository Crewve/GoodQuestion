-- 002_story_sessions_mission_phase — 미션 진행 상태 컬럼 1종 추가
-- 근거: 기능명세서 2.4.3(미션 노출은 장면당 1회, 미션 완료를 CLOSING 조건 ③에 반영 — US2 T040·T041)
--   — 노출·완료는 턴 사이에 서버가 기억해야 하는 세션 상태인데 기존 컬럼으로 표현 불가.
--   무상태 파생(분석 이력 재평가) 대안은 판정 규칙 변경 시 과거 해석이 달라지는 리스크로 기각.
-- 사용자 승인 후 적용(2026-08-11) — children 2컬럼(001) 선례와 동일 절차.
-- 장면 전환 시 scene_goal_met처럼 리셋된다(장면 단위 상태).
-- Notion 「DB 구조_260803_수정안」 개정에 반영 예정(사후 정합).
-- 적용: Supabase MCP apply_migration(story_sessions_mission_phase), 2026-08-11

alter table public.story_sessions
  add column if not exists mission_phase varchar;

comment on column public.story_sessions.mission_phase is
  '현재 장면 미션 상태: null=미노출, exposed=팝업 노출됨, completed=미션 응답 제출 완료 — 장면당 1회 노출·CLOSING 조건 ③ 근거(기능명세서 2.4.3). Notion 설계서 개정 반영 대상';
