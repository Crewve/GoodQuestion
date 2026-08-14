// T020(STT 절반) — 오디오 파일→SttResult 왕복 검증 CLI. 게이트 신호를 임계값과 나란히 출력해 T022 튜닝 도구를 겸한다.
// 실행: npx tsx scripts/stt-check.ts <오디오파일> [--scene sc_banggui_03] [--reply "직전 캐릭터 대사"] [--hint "힌트 직접 지정"]
// 예: npx tsx scripts/stt-check.ts out/voice-samples/narrator__Hyoeun.mp3
import { createReadStream, existsSync } from 'node:fs';
import { loadEnvLocal, requireEnv } from './lib/env';
import { buildSttHint, speechToText } from '../src/lib/stt';
import { sttGate } from '../src/lib/config';

function parseArgs(argv: string[]) {
  const args = { file: '', scene: '', reply: '', hint: '' };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--scene') args.scene = argv[++i] ?? '';
    else if (argv[i] === '--reply') args.reply = argv[++i] ?? '';
    else if (argv[i] === '--hint') args.hint = argv[++i] ?? '';
    else rest.push(argv[i]);
  }
  args.file = rest[0] ?? '';
  return args;
}

const fmt = (n: number | null, digits = 3) => (n === null ? 'null(통과)' : n.toFixed(digits));

async function main() {
  loadEnvLocal();
  requireEnv('OPENAI_API_KEY');
  const { file, scene, reply, hint } = parseArgs(process.argv.slice(2));
  if (!file || !existsSync(file)) {
    console.error('사용법: npx tsx scripts/stt-check.ts <오디오파일> [--scene sc_*] [--reply "직전 대사"] [--hint "직접 지정"]');
    process.exit(1);
  }

  const prompt = hint || buildSttHint(scene || undefined, reply || undefined);
  const started = Date.now();
  const r = await speechToText(createReadStream(file), { hint: prompt });
  const elapsed = Date.now() - started;
  const s = r.gate.signals;

  console.log(`file    : ${file}`);
  console.log(`hint    : ${prompt.length}자 — ${prompt.slice(0, 80)}${prompt.length > 80 ? '…' : ''}`);
  console.log(`raw     : ${r.sttRawText}`);
  console.log(`text    : ${r.text}${r.corrected ? ' (교정 반영)' : ' (교정 없음/폴백)'}`);
  console.log(`failed  : ${r.failed}${r.gate.reason ? ` — ${r.gate.reason}` : ''}`);
  console.log('signals :');
  console.log(`  ①trimmedLength  = ${s.trimmedLength} (실패 기준 ≤${sttGate.maxTrivialChars})`);
  console.log(`  ②noSpeechProb   = ${fmt(s.noSpeechProb)} (실패 기준 >${sttGate.noSpeechProbMax})`);
  console.log(`  ③avgLogprob     = ${fmt(s.avgLogprob)} (실패 기준 <${sttGate.avgLogprobMin})`);
  console.log(`  ④maxNgramRepeat = ${s.maxNgramRepeat} (${sttGate.ngramSize}-gram, 실패 기준 >${sttGate.ngramMaxRepeats})`);
  console.log(`  ⑤matchedPhrase  = ${s.matchedPhrase ?? 'null(통과)'}`);
  console.log(`meta    : ${fmt(r.durationSec, 1)}s · lang=${r.language} · ${elapsed}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
