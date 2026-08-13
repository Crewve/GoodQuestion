// T022 — 게이트 임계 1차 튜닝 배치 러너. 라벨된 녹음 폴더를 STT 왕복시켜 신호 분포·오분류·임계 후보를 산출한다.
// 파일명 규칙: {label}__{자유기술}.{mp4|m4a|webm|mp3|wav|ogg} — label ∈ ok(정상 발화)·silence(무음)·noise(소음만)·short(1~2자 발화)
//   예: ok__ipad__호랑이답변.mp4, silence__android__빈방.webm, short__ipad__응.mp4
// 실행: npx tsx scripts/stt-tune.ts [디렉토리=out/recordings] [--scene sc_banggui_03] [--reply "직전 캐릭터 대사"]
// 출력: 콘솔 요약(분포·오분류·env 권고값) + out/stt-tune-report.json (신호 원본 보존 — config 기본값 갱신 근거 기록)
import { createReadStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { loadEnvLocal, requireEnv } from './lib/env';
import { buildSttHint, speechToText } from '../src/lib/stt';
import { sttGate } from '../src/lib/config';
import type { SttGateReason, SttGateSignals } from '../src/lib/stt/gates';

const AUDIO_EXTS = new Set(['.mp3', '.mp4', '.m4a', '.webm', '.wav', '.ogg']);
const FAIL_LABELS = new Set(['silence', 'noise', 'short']);
type Label = 'ok' | 'silence' | 'noise' | 'short' | 'unknown';

type FileResult = {
  file: string;
  label: Label;
  expectedFail: boolean;
  failed: boolean;
  reason: SttGateReason | null;
  signals: SttGateSignals;
  raw: string;
  durationSec: number | null;
  error?: string;
};

function parseArgs(argv: string[]) {
  const args = { dir: 'out/recordings', scene: '', reply: '' };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--scene') args.scene = argv[++i] ?? '';
    else if (argv[i] === '--reply') args.reply = argv[++i] ?? '';
    else rest.push(argv[i]);
  }
  if (rest[0]) args.dir = rest[0];
  return args;
}

function labelOf(name: string): Label {
  // 구분자는 __ 권장이지만 실무 파일명(_ 단일·하이픈)도 수용한다
  const m = name.toLowerCase().match(/^(ok|silence|noise|short)(?=[_\-.])/);
  return m ? (m[1] as Label) : 'unknown';
}

const fmt = (n: number | null, digits = 3) => (n === null ? 'null' : n.toFixed(digits));

function stats(values: number[]): { min: number; med: number; max: number } | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  return { min: s[0], med, max: s[s.length - 1] };
}

const fmtStats = (s: ReturnType<typeof stats>, digits = 3) =>
  s ? `min ${s.min.toFixed(digits)} · med ${s.med.toFixed(digits)} · max ${s.max.toFixed(digits)}` : '(신호 없음)';

/** 저장된 신호만으로 게이트 재판정 — runSttGates와 동일한 순서·비교 (임계 후보의 가상 적용용) */
function judge(signals: SttGateSignals, cfg: { maxTrivialChars: number; noSpeechProbMax: number; avgLogprobMin: number; ngramMaxRepeats: number }): SttGateReason | null {
  if (signals.trimmedLength <= cfg.maxTrivialChars) return 'TOO_SHORT';
  if (signals.noSpeechProb !== null && signals.noSpeechProb > cfg.noSpeechProbMax) return 'NO_SPEECH';
  if (signals.avgLogprob !== null && signals.avgLogprob < cfg.avgLogprobMin) return 'LOW_CONFIDENCE';
  if (signals.maxNgramRepeat > cfg.ngramMaxRepeats) return 'NGRAM_REPEAT';
  if (signals.matchedPhrase !== null) return 'HALLUCINATION_PHRASE';
  return null;
}

/** ok 최악값과 기대실패 최선값 사이 중간점 권고 — 분리가 없으면 null(겹침 보고) */
function recommend(okWorst: number | null, failBest: number | null, mode: 'max' | 'min'): number | null {
  if (okWorst === null || failBest === null) return null;
  const separated = mode === 'max' ? okWorst < failBest : okWorst > failBest;
  if (!separated) return null;
  return Math.round(((okWorst + failBest) / 2) * 100) / 100;
}

async function main() {
  loadEnvLocal();
  requireEnv('OPENAI_API_KEY');
  const { dir, scene, reply } = parseArgs(process.argv.slice(2));

  if (!existsSync(dir)) {
    console.error(`오류: 디렉토리가 없습니다 — ${dir}`);
    console.error('녹음 파일을 만들어 넣으세요. 파일명 규칙: {ok|silence|noise|short}__{기기}__{설명}.{mp4|webm|…}');
    process.exit(1);
  }
  const files = readdirSync(dir)
    .filter((f) => AUDIO_EXTS.has(extname(f).toLowerCase()) && statSync(join(dir, f)).isFile())
    .sort();
  if (files.length === 0) {
    console.error(`오류: ${dir}에 오디오 파일이 없습니다 (지원: ${[...AUDIO_EXTS].join(' ')})`);
    process.exit(1);
  }

  const hint = buildSttHint(scene || undefined, reply || undefined);
  console.log(`디렉토리: ${dir} (${files.length}건) · 힌트 ${hint.length}자${scene ? ` (--scene ${scene})` : ''}`);
  console.log(
    `현행 임계: ①≤${sttGate.maxTrivialChars}자 ②noSpeech>${sttGate.noSpeechProbMax} ③logprob<${sttGate.avgLogprobMin} ④${sttGate.ngramSize}-gram>${sttGate.ngramMaxRepeats}회 ⑤상투구 ${sttGate.hallucinationPhrases.length}종\n`,
  );

  const results: FileResult[] = [];
  for (const [i, file] of files.entries()) {
    const label = labelOf(file);
    const expectedFail = FAIL_LABELS.has(label);
    try {
      const r = await speechToText(createReadStream(join(dir, file)), { hint });
      const s = r.gate.signals;
      results.push({ file, label, expectedFail, failed: r.failed, reason: r.gate.reason, signals: s, raw: r.sttRawText, durationSec: r.durationSec });
      const verdict = r.failed ? `실패(${r.gate.reason})` : '통과';
      console.log(`[${i + 1}/${files.length}] ${file} → ${verdict} ①${s.trimmedLength} ②${fmt(s.noSpeechProb)} ③${fmt(s.avgLogprob, 2)} · raw: ${r.sttRawText.slice(0, 60) || '(빈 문자열)'}`);
    } catch (e) {
      // 파일 하나의 API 오류로 배치 전체를 버리지 않는다 — 오류 기록 후 계속
      const message = e instanceof Error ? e.message : String(e);
      results.push({ file, label, expectedFail, failed: true, reason: null, signals: { trimmedLength: 0, noSpeechProb: null, avgLogprob: null, maxNgramRepeat: 0, matchedPhrase: null, hintEcho: false }, raw: '', durationSec: null, error: message });
      console.log(`[${i + 1}/${files.length}] ${file} → 오류: ${message}`);
    }
  }

  const measured = results.filter((r) => !r.error);
  const ok = measured.filter((r) => r.label === 'ok');
  const expectFail = measured.filter((r) => r.expectedFail);
  const unknown = measured.filter((r) => r.label === 'unknown');
  if (unknown.length > 0) {
    console.log(`\n⚠️ 라벨 없는 파일 ${unknown.length}건 — 분포·권고 계산에서 제외: ${unknown.map((r) => r.file).join(', ')}`);
  }

  const pick = (rs: FileResult[], key: 'noSpeechProb' | 'avgLogprob') =>
    rs.map((r) => r.signals[key]).filter((v): v is number => v !== null);
  const okNoSpeech = stats(pick(ok, 'noSpeechProb'));
  const failNoSpeech = stats(pick(expectFail, 'noSpeechProb'));
  const okLogprob = stats(pick(ok, 'avgLogprob'));
  const failLogprob = stats(pick(expectFail, 'avgLogprob'));

  console.log('\n── 신호 분포 ──');
  console.log(`②noSpeechProb  ok(${ok.length}): ${fmtStats(okNoSpeech)} | 기대실패(${expectFail.length}): ${fmtStats(failNoSpeech)}`);
  console.log(`③avgLogprob    ok(${ok.length}): ${fmtStats(okLogprob, 2)} | 기대실패(${expectFail.length}): ${fmtStats(failLogprob, 2)}`);

  const falseRejects = ok.filter((r) => r.failed);
  const falseAccepts = expectFail.filter((r) => !r.failed);
  console.log('\n── 오분류 (현행 임계) ──');
  console.log(`false reject(정상인데 실패) ${falseRejects.length}건${falseRejects.length ? ':' : ''}`);
  for (const r of falseRejects) console.log(`  - ${r.file} — ${r.reason} (②${fmt(r.signals.noSpeechProb)} ③${fmt(r.signals.avgLogprob, 2)})`);
  console.log(`false accept(실패 기대인데 통과) ${falseAccepts.length}건${falseAccepts.length ? ' — raw는 ⑤상투구 후보:' : ''}`);
  for (const r of falseAccepts) console.log(`  - ${r.file} — raw: ${r.raw.slice(0, 80)}`);

  // ②는 높을수록 실패(ok 최대 < 실패 최소면 분리), ③은 낮을수록 실패(ok 최소 > 실패 최대면 분리)
  const recNoSpeech = recommend(okNoSpeech?.max ?? null, failNoSpeech?.min ?? null, 'max');
  const recLogprob = recommend(okLogprob?.min ?? null, failLogprob?.max ?? null, 'min');

  console.log('\n── 임계 후보 ──');
  console.log(
    `②noSpeechProbMax: ok 최악 ${fmt(okNoSpeech?.max ?? null)} / 실패 최선 ${fmt(failNoSpeech?.min ?? null)} → ` +
      (recNoSpeech !== null ? `권고 ${recNoSpeech} (STT_GATE_NO_SPEECH_PROB=${recNoSpeech})` : '분리 불가/표본 부족 — 현행 유지 검토'),
  );
  console.log(
    `③avgLogprobMin  : ok 최악 ${fmt(okLogprob?.min ?? null, 2)} / 실패 최선 ${fmt(failLogprob?.max ?? null, 2)} → ` +
      (recLogprob !== null ? `권고 ${recLogprob} (STT_GATE_AVG_LOGPROB=${recLogprob})` : '분리 불가/표본 부족 — 현행 유지 검토'),
  );

  const candidate = {
    maxTrivialChars: sttGate.maxTrivialChars,
    noSpeechProbMax: recNoSpeech ?? sttGate.noSpeechProbMax,
    avgLogprobMin: recLogprob ?? sttGate.avgLogprobMin,
    ngramMaxRepeats: sttGate.ngramMaxRepeats,
  };
  const labeled = measured.filter((r) => r.label !== 'unknown');
  const reFalseReject = labeled.filter((r) => r.label === 'ok' && judge(r.signals, candidate) !== null);
  const reFalseAccept = labeled.filter((r) => r.expectedFail && judge(r.signals, candidate) === null);
  console.log(`권고 적용 시 재판정: false reject ${reFalseReject.length}건 · false accept ${reFalseAccept.length}건 (라벨 표본 ${labeled.length}건)`);

  mkdirSync('out', { recursive: true });
  const reportPath = join('out', 'stt-tune-report.json');
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dir,
        hint: { scene: scene || null, reply: reply || null, length: hint.length },
        currentConfig: sttGate,
        recommendation: { noSpeechProbMax: recNoSpeech, avgLogprobMin: recLogprob },
        recheckWithCandidate: { falseRejects: reFalseReject.map((r) => r.file), falseAccepts: reFalseAccept.map((r) => r.file) },
        results,
      },
      null,
      2,
    ),
  );
  console.log(`\n리포트: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
