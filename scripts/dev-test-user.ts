// 테스트 보호자·아이 시드 (T038 리허설용, 멱등) — 가입 화면(T045) 전까지 E2E 검증에 사용.
// 실행: npx tsx scripts/dev-test-user.ts
// 출력의 email/password로 로그인, childId·storyId로 /play/dev?child=..&story=.. 진입.
import { createServiceClient } from "./lib/supabase";

const EMAIL = "test-parent@goodquestion.dev";
const PASSWORD = "goodq-test-1234"; // 로컬 개발용 고정 크리덴셜 — 운영 배포 대상 아님
const CHILD_NAME = "민준"; // 받침 있는 이름 — R-07 호격 '민준아'/주격 '민준이' 치환 검증 겸용

async function main() {
  const admin = createServiceClient();

  const { data: list, error: listError } = await admin.auth.admin.listUsers();
  if (listError) throw new Error(`유저 목록 조회 실패: ${listError.message}`);
  let userId = list.users.find((u) => u.email === EMAIL)?.id;
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(`유저 생성 실패: ${error?.message}`);
    userId = data.user.id;
  }

  // created_at은 스키마에 기본값이 없어 명시 (Notion 설계서 원형 유지 — R-11)
  const { error: parentError } = await admin
    .from("parents")
    .upsert({ id: userId, name: "테스트 보호자", created_at: new Date().toISOString() });
  if (parentError) throw new Error(`parents upsert 실패: ${parentError.message}`);

  const { data: existingChild } = await admin
    .from("children")
    .select("id")
    .eq("parent_id", userId)
    .eq("name", CHILD_NAME)
    .maybeSingle();
  let childId = existingChild?.id;
  if (!childId) {
    const { data: created, error } = await admin
      .from("children")
      .insert({
        id: crypto.randomUUID(), // id도 DB 기본값 없음 (Notion 설계서 원형 — 시드와 동일하게 클라이언트 생성)
        parent_id: userId,
        name: CHILD_NAME,
        birth_year: 2019,
        birth_date: "2019-03-15",
        avatar_key: "boy-1",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !created) throw new Error(`children insert 실패: ${error?.message}`);
    childId = created.id;
  }

  const { data: story } = await admin.from("stories").select("id, title").limit(1).single();

  console.log(JSON.stringify({ email: EMAIL, password: PASSWORD, userId, childId, childName: CHILD_NAME, storyId: story?.id, storyTitle: story?.title }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
