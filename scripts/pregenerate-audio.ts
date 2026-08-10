// T021 — 고정 대사 14건 사전 생성 → `fixed-audio` 버킷 업로드 (파일명 {key}.mp3, R-06 잠정).
// CLOSING·내레이션·시스템 대사는 런타임 TTS 없이 이 산출물을 재생한다 (LLM/TTS 장애와 무관하게 성공해야 하는 경로).
// 멱등: 버킷에 이미 있으면 스킵 (대사·보이스 변경 재생성은 --force). 합성은 로컬 캐시 경유라 재실행 과금 없음.
// 실행: npx tsx scripts/pregenerate-audio.ts [--force]
import { readFileSync } from 'node:fs';
import { loadEnvLocal, requireEnv } from './lib/env';
import { createServiceClient } from './lib/supabase';
import { narrationSentenceKey, splitNarrationSentences } from '../src/lib/narration';
import { synthesizeWithCache, voiceForRole } from '../src/lib/tts';

const BUCKET = 'fixed-audio';

type TtsLine = { key: string; kind: string; scene?: string | null; voice_role: string; has_name_placeholder: boolean; text: string };

/**
 * 'ㅇㅇ'(아이 이름) 자리표시자 → '친구' 호칭 치환 (R-07 잠정 — 기획이 실명 호출 확정 시 해당 2건만 런타임 TTS 전환).
 * 조사까지 자연스럽게: 호격 'ㅇㅇ아'→'친구야', 주격 'ㅇㅇ이'→'친구'(이/가 없이 자연), 그 외 'ㅇㅇ'→'친구'.
 */
function substituteName(text: string): string {
  return text.replaceAll('ㅇㅇ아', '친구야').replaceAll('ㅇㅇ이', '친구').replaceAll('ㅇㅇ', '친구');
}

async function main() {
  loadEnvLocal();
  requireEnv('TYPECAST_API_KEY');
  const force = process.argv.includes('--force');
  const storage = createServiceClient().storage.from(BUCKET);
  const { lines: rawLines } = JSON.parse(readFileSync('fixtures/tts-lines.banggui.json', 'utf8')) as { lines: TtsLine[] };

  // 내레이션은 장면 전체본에 더해 문장별 파일(`_s{i}`)도 생성 — 도입/전개 화면(2.4.1·2.4.2)이
  // 문장 단위 자동 재생을 요구한다. 분리 규칙은 화면과 동일 함수(splitNarrationSentences) 공유.
  const sentenceLines: TtsLine[] = rawLines
    .filter((l) => l.kind === 'narration' && l.scene)
    .flatMap((l) =>
      splitNarrationSentences(l.text).map((sentence, i) => ({
        ...l,
        key: narrationSentenceKey(l.scene!, i),
        text: sentence,
      })),
    );
  const lines = [...rawLines, ...sentenceLines];

  let synthesized = 0;
  let cached = 0;
  let skipped = 0;
  let chars = 0;

  // 어댑터 내장 동시성 2 큐가 무료 플랜 한도를 지킨다 — 여기서는 전부 던지고 기다린다
  await Promise.all(
    lines.map(async (line) => {
      const object = `${line.key}.mp3`;
      if (!force) {
        try {
          const { data: exists } = await storage.exists(object);
          if (exists) {
            skipped += 1;
            console.log(`− ${object} — 이미 있음, 스킵`);
            return;
          }
        } catch {
          // exists 실패 시 업로드(upsert) 경로로 진행
        }
      }

      const text = line.has_name_placeholder ? substituteName(line.text) : line.text;
      const voice = voiceForRole(line.voice_role);
      const { buffer, source } = await synthesizeWithCache(text, voice.voice_id, { model: voice.model });
      if (source === 'api') {
        synthesized += 1;
        chars += text.length;
      } else {
        cached += 1;
      }

      const { error } = await storage.upload(object, buffer, { contentType: 'audio/mpeg', upsert: true });
      if (error) throw new Error(`${object} 업로드 실패: ${error.message}`);
      console.log(`✓ ${object} — ${voice.voice_name} · ${text.length}자 · ${(buffer.length / 1024).toFixed(0)}KB [${source}]`);
    }),
  );

  // 공개 URL 전수 검증 — 업로드 직후 재생 가능해야 T038 배선·데모에서 안 놀란다
  let urlFailures = 0;
  for (const line of lines) {
    const url = storage.getPublicUrl(`${line.key}.mp3`).data.publicUrl;
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) {
      urlFailures += 1;
      console.error(`✗ URL ${res.status}: ${url}`);
    }
  }

  console.log(`\n완료 — 신규 합성 ${synthesized}건(${chars}자 과금) · 캐시 히트 ${cached}건 · 스킵 ${skipped}건 / URL 검증 ${lines.length - urlFailures}/${lines.length} OK`);
  if (urlFailures > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
