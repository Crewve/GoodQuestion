// external_id(노션 슬러그) → uuid 결정적 매핑 (T008)
// DB에 external_id 컬럼이 없으므로, RFC 4122 UUID v5(sha1 기반)로 항상 같은 uuid를 계산해
// 시드 재실행 시 upsert(onConflict: id)가 같은 행을 갱신하게 한다. 서버·CLI 공용.
import { createHash } from 'node:crypto';

// 프로젝트 고정 네임스페이스 — 변경 시 기존 시드 행과의 매핑이 전부 끊어진다. 절대 바꾸지 말 것.
const NAMESPACE = '3f3ea2a0-7c2b-4f2a-9d55-6f1b2a9c0e41';

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ''), 'hex');
}

/** external_id 하나당 영구 고정 uuid v5를 반환한다. */
export function externalIdToUuid(externalId: string): string {
  const hash = createHash('sha1')
    .update(uuidToBytes(NAMESPACE))
    .update(Buffer.from(externalId, 'utf8'))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
