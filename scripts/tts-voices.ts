// T018 — 보이스 후보 샘플 생성 → 팀 투표용 (크리티컬 패스, Day 0 최우선)
// 역할 4종 × 후보 3개, 대사는 fixtures/tts-lines.banggui.json의 실제 고정 대사에서 role별 최단 문장 사용
// ('ㅇㅇ' 자리표시자는 R-07 잠정 결정대로 '친구야' 치환).
// 실행: npx tsx scripts/tts-voices.ts   → out/voice-samples/*.mp3 (git 미추적) 공유해 투표
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvLocal } from './lib/env';
import { listVoices, synthesizeWithCache } from '../src/lib/tts';

/** 역할별 후보 — 한국어 보이스, 이름은 /v1/voices의 voice_name (성격 적합성은 팀 투표로 판정) */
const CANDIDATES: Record<string, { label: string; names: string[] }> = {
  ch_banggui_daughter_in_law: { label: '며느리(젊은 여성)', names: ['Seohyeon', 'Daeun', 'Gowoon'] },
  ch_banggui_father_in_law: { label: '시아버지(노년 남성)', names: ['Byunghun', 'Kangil', 'Minuk'] },
  ch_banggui_village_chief: { label: '마을 이장(중년 남성)', names: ['Sanghyun', 'Juwan', 'Leehyun'] },
  narrator: { label: '내레이터(따뜻한 낭독)', names: ['Jungsook', 'Moonjung', 'Hyoeun'] },
};

const OUT_DIR = 'out/voice-samples';

type TtsLine = { key: string; voice_role: string; text: string; has_name_placeholder: boolean };

function sampleTextByRole(): Record<string, string> {
  const { lines } = JSON.parse(readFileSync('fixtures/tts-lines.banggui.json', 'utf8')) as { lines: TtsLine[] };
  const byRole: Record<string, string> = {};
  for (const line of lines) {
    const text = line.has_name_placeholder ? line.text.replaceAll('ㅇㅇ', '친구') : line.text;
    // 역할별 최단 대사 채택 — 무료 한도(월 3만 자) 절약하면서 실제 콘텐츠로 판정
    if (!byRole[line.voice_role] || text.length < byRole[line.voice_role].length) {
      byRole[line.voice_role] = text;
    }
  }
  return byRole;
}

async function main() {
  loadEnvLocal();
  const texts = sampleTextByRole();
  const voices = await listVoices();
  mkdirSync(OUT_DIR, { recursive: true });

  let totalChars = 0;
  const jobs: Array<Promise<void>> = [];
  for (const [role, { label, names }] of Object.entries(CANDIDATES)) {
    const text = texts[role];
    if (!text) {
      console.warn(`⚠ ${role}: tts-lines에 해당 role 대사 없음 — 스킵`);
      continue;
    }
    for (const name of names) {
      const voice = voices.find((v) => v.voice_name === name && v.model === 'ssfm-v30')
        ?? voices.find((v) => v.voice_name === name);
      if (!voice) {
        console.warn(`⚠ ${label} 후보 "${name}" — 보이스 목록에 없음, 스킵`);
        continue;
      }
      totalChars += text.length;
      jobs.push(
        synthesizeWithCache(text, voice.voice_id, { model: voice.model }).then(({ buffer, source }) => {
          const file = join(OUT_DIR, `${role}__${name}.mp3`);
          writeFileSync(file, buffer);
          console.log(`✓ ${label} · ${name} (${voice.voice_id}) → ${file} [${source}]`);
        }),
      );
    }
  }
  await Promise.all(jobs); // 동시성 2 제한은 어댑터 내장 큐가 보장

  console.log(`\n샘플 생성 완료 — 합성 문자 수 약 ${totalChars}자 (월 3만 자 한도)`);
  console.log(`다음 단계: ${OUT_DIR}/ 의 mp3를 팀 채널에 공유해 역할별 1개씩 투표 →`);
  console.log('확정되면 src/lib/tts/voice-map.json에 기록 (T019)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
