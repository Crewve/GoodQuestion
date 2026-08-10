import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * .env.local 로더 — CLI 스크립트 공용 (tsx 실행 시 Next.js 밖이라 자동 로드가 없음).
 * 이미 설정된 process.env 값은 덮어쓰지 않는다.
 */
export function loadEnvLocal(file = ".env.local"): void {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), file), "utf8");
  } catch {
    return; // 파일 없으면 조용히 통과 (CI 등에서는 실환경 변수 사용)
  }
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, value] = m;
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

/** 필수 환경변수 조회 — 비어 있으면 명확한 에러로 종료 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`오류: 환경변수 ${key}가 없습니다. .env.local을 확인하세요 (.env.example 참고).`);
    process.exit(1);
  }
  return value;
}
