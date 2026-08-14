-- 001_children_profile_fields — children 프로필 컬럼 2종 추가
-- 근거: CLAUDE.md SSOT(충돌 시 기능명세서 우선, 2026-08-10 확정) + 사용자 승인 후 적용.
-- 기능명세서 요건: 생년월일 8자리(YYYYMMDD) 저장·만 나이 배지(2.1), 캐릭터(아바타) 선택 저장(1.2.2/2.1.1)
--   — 사용자 입력 데이터라 코드 파생 불가, DB 저장이 유일한 해법.
-- scene_type은 추가하지 않는다 — fixtures 파생(src/lib/story.ts sceneTypeOf)으로 충족.
-- Notion 「DB 구조_260803_수정안」 개정에 반영 예정(사후 정합).
-- 적용: Supabase MCP apply_migration(children_profile_fields), 2026-08-10

alter table public.children
  add column if not exists avatar_key varchar,
  add column if not exists birth_date date;

comment on column public.children.avatar_key is '프로필 캐릭터 키(4종) — 기능명세서 1.2.2/2.1.1. Notion 설계서 개정 반영 대상';
comment on column public.children.birth_date is '생년월일(YYYYMMDD 입력) — 만 나이 배지 계산(기능명세서 2.1). birth_year는 리포트 호환 유지. Notion 설계서 개정 반영 대상';
