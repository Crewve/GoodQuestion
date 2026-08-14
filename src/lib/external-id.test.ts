// T008 시드 멱등성의 근거 — external_id→uuid 결정적 매핑 (Vitest)
import { expect, test } from 'vitest';
import { externalIdToUuid } from './external-id';

test('같은 external_id는 프로세스가 달라도 항상 같은 uuid로 매핑된다 (시드 재실행 upsert 근거)', () => {
  expect(externalIdToUuid('sc_banggui_03')).toBe(externalIdToUuid('sc_banggui_03'));
});

test('uuid v5 형식(version=5, variant=10xx)을 만족한다 — DB uuid 컬럼 호환', () => {
  expect(externalIdToUuid('s_banggui_daughter_in_law_001')).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test('다른 external_id는 서로 다른 uuid를 얻는다', () => {
  expect(externalIdToUuid('sc_banggui_03')).not.toBe(externalIdToUuid('sc_banggui_04'));
});
