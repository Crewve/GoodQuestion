-- 001_mvp_additions (T007) — 스키마 갭 보강 (data-model.md §3, research R-11)
-- Notion 「DB 구조_260803_수정안」이 SoT — 본 추가 컬럼 3종은 기능명세서 명시 요건으로 팀 공유 후 적용.
-- 적용: Supabase MCP apply_migration (버전 관리는 supabase_migrations.schema_migrations)

-- 갭 1: 도입/전개/대화 구분 — 진행률 N 계산(전개+대화 쌍=1, 도입 제외)·화면 렌더 분기에 필수
alter table public.story_scenes
  add column if not exists scene_type varchar
    check (scene_type in ('도입', '전개', '대화'));

comment on column public.story_scenes.scene_type is
  '장면 유형(도입/전개/대화) — 기능명세서 2.4 비고 요청. 시드(scripts/seed.ts)가 fixtures type/label에서 채움';

-- 갭 2: 아이 프로필 아바타 캐릭터(4종)·생년월일(YYYYMMDD, 만 나이 배지) — birth_year는 리포트 호환용 유지
alter table public.children
  add column if not exists avatar_key varchar,
  add column if not exists birth_date date;

comment on column public.children.avatar_key is '프로필 캐릭터 키(4종) — 기능명세서 1.2.2/2.1.1';
comment on column public.children.birth_date is '생년월일 — 만 나이 배지 계산(기능명세서 2.1). birth_year는 유지(R-11-2)';
