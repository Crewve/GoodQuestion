import { createServiceClient } from "./lib/supabase";

/**
 * T006 — Supabase Storage 버킷 생성 (멱등)
 *   fixed-audio : 고정 대사 사전 생성 mp3 ({key}.mp3) — 공개 읽기
 *   tts-cache   : 가변 대사 런타임 캐시 (hash(voiceId+text).mp3) — 공개 읽기
 * 실행: npx tsx scripts/setup-buckets.ts
 */
const BUCKETS = ["fixed-audio", "tts-cache"] as const;

async function main() {
  const supabase = createServiceClient();

  const { data: existing, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw new Error(`버킷 목록 조회 실패: ${listError.message}`);
  const existingNames = new Set(existing.map((b) => b.name));

  for (const name of BUCKETS) {
    if (existingNames.has(name)) {
      console.log(`✓ ${name} — 이미 존재 (스킵)`);
      continue;
    }
    const { error } = await supabase.storage.createBucket(name, {
      public: true,
      allowedMimeTypes: ["audio/mpeg"],
    });
    if (error) throw new Error(`${name} 생성 실패: ${error.message}`);
    console.log(`+ ${name} — 생성 완료 (공개 읽기, audio/mpeg)`);
  }
  console.log("버킷 준비 완료.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
