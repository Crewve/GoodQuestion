// T020(TTS 절반) — 텍스트→mp3 왕복 검증 CLI. 2회째 실행은 캐시 히트(과금 0)여야 정상.
// 실행: npx tsx scripts/tts-check.ts "안녕, 나는 며느리야" --voice Seohyeon [--out out/tts-check.mp3]
// --voice 에는 voice_name 또는 voice_id 사용. (STT 절반 stt-check.ts는 T015 이후 — OPENAI_API_KEY 필요)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadEnvLocal } from './lib/env';
import { createServiceClient } from './lib/supabase';
import { listVoices, synthesizeWithCache } from '../src/lib/tts';

function parseArgs(argv: string[]) {
  const args = { text: '', voice: '', out: 'out/tts-check.mp3', storage: false };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--voice') args.voice = argv[++i] ?? '';
    else if (argv[i] === '--out') args.out = argv[++i] ?? args.out;
    else if (argv[i] === '--storage') args.storage = true; // 2층(tts-cache 버킷) 캐시까지 검증
    else rest.push(argv[i]);
  }
  args.text = rest.join(' ').trim();
  return args;
}

async function main() {
  loadEnvLocal();
  const { text, voice, out, storage } = parseArgs(process.argv.slice(2));
  if (!text || !voice) {
    console.error('사용법: npx tsx scripts/tts-check.ts "<텍스트>" --voice <voice_name|voice_id> [--out 파일]');
    process.exit(1);
  }

  const voices = await listVoices();
  const match = voices.find((v) => v.voice_id === voice)
    ?? voices.find((v) => v.voice_name === voice && v.model === 'ssfm-v30')
    ?? voices.find((v) => v.voice_name === voice);
  if (!match) {
    console.error(`보이스를 찾을 수 없습니다: ${voice}`);
    process.exit(1);
  }

  const started = Date.now();
  const { buffer, key, source, url } = await synthesizeWithCache(text, match.voice_id, {
    model: match.model,
    storage: storage ? createServiceClient() : undefined,
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, buffer);

  console.log(`voice   : ${match.voice_name} (${match.voice_id}, ${match.model})`);
  console.log(`text    : ${text} (${text.length}자)`);
  console.log(`result  : ${out} — ${buffer.length.toLocaleString()} bytes, ${Date.now() - started}ms`);
  console.log(`cache   : ${source === 'api' ? 'MISS → 신규 합성(과금)' : `HIT(${source}) — 과금 0`} [key=${key.slice(0, 12)}…]`);
  if (url) console.log(`url     : ${url}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
