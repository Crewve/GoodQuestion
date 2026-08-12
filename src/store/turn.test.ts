// T033 — 턴 상태머신 전이 테스트 (data-model §5)
// CHAR_SPEAKING → RECORDING → TRANSCRIBING → REVIEW → SUBMITTED → CHAR_SPEAKING
// 게이트 실패: TRANSCRIBING → RECORDING 복귀 (메시지 미생성)
import { beforeEach, expect, test } from 'vitest';
import { useTurnStore } from './turn';

beforeEach(() => {
  useTurnStore.getState().reset();
});

test('초기 상태는 CHAR_SPEAKING (캐릭터 대사 자동 재생 중)', () => {
  expect(useTurnStore.getState().phase).toBe('CHAR_SPEAKING');
});

test('캐릭터 오디오 종료 → RECORDING 자동 시작 (FR-007)', () => {
  useTurnStore.getState().characterAudioEnded();
  expect(useTurnStore.getState().phase).toBe('RECORDING');
});

test('녹음 종료 → TRANSCRIBING', () => {
  useTurnStore.getState().characterAudioEnded();
  useTurnStore.getState().stopRecording();
  expect(useTurnStore.getState().phase).toBe('TRANSCRIBING');
});

test('STT 성공 → REVIEW로 전이하고 텍스트를 보관한다 (수정 불가 표시용)', () => {
  const store = useTurnStore.getState();
  store.characterAudioEnded();
  store.stopRecording();
  store.sttSucceeded({ text: '며느리가 힘들었을 것 같아요', sttRawText: '며느리가 힘들었을것같아요', failed: false });
  expect(useTurnStore.getState().phase).toBe('REVIEW');
  expect(useTurnStore.getState().sttText).toBe('며느리가 힘들었을 것 같아요');
  expect(useTurnStore.getState().sttRawText).toBe('며느리가 힘들었을것같아요');
});

test('STT 게이트 실패 → RECORDING 복귀, 텍스트는 남기지 않는다', () => {
  const store = useTurnStore.getState();
  store.characterAudioEnded();
  store.stopRecording();
  store.sttFailed();
  expect(useTurnStore.getState().phase).toBe('RECORDING');
  expect(useTurnStore.getState().sttText).toBeNull();
});

test('보내기 → SUBMITTED, 응답 도착 → CHAR_SPEAKING 순환 및 텍스트 초기화', () => {
  const store = useTurnStore.getState();
  store.characterAudioEnded();
  store.stopRecording();
  store.sttSucceeded({ text: '텍스트', sttRawText: '텍스트', failed: false });
  store.submit();
  expect(useTurnStore.getState().phase).toBe('SUBMITTED');
  store.characterSpeaking();
  expect(useTurnStore.getState().phase).toBe('CHAR_SPEAKING');
  expect(useTurnStore.getState().sttText).toBeNull();
});

test('현재 단계에 맞지 않는 전이는 무시된다 (예: CHAR_SPEAKING에서 submit)', () => {
  useTurnStore.getState().submit();
  expect(useTurnStore.getState().phase).toBe('CHAR_SPEAKING');
  useTurnStore.getState().sttFailed();
  expect(useTurnStore.getState().phase).toBe('CHAR_SPEAKING');
});

test('REVIEW에서 재녹음 → RECORDING 복귀, 이전 STT 텍스트는 버린다 (T072 — 보내기 전 재녹음)', () => {
  const store = useTurnStore.getState();
  store.characterAudioEnded();
  store.stopRecording();
  store.sttSucceeded({ text: '잘못 인식된 말', sttRawText: '잘못 인식된 말', failed: false });
  expect(useTurnStore.getState().phase).toBe('REVIEW');
  useTurnStore.getState().rerecord();
  expect(useTurnStore.getState().phase).toBe('RECORDING');
  expect(useTurnStore.getState().sttText).toBeNull();
  expect(useTurnStore.getState().sttRawText).toBeNull();
});

test('REVIEW가 아닌 단계의 재녹음 요청은 무시된다 (SUBMITTED 이후 되돌리기 불가)', () => {
  const store = useTurnStore.getState();
  store.characterAudioEnded();
  store.stopRecording();
  store.sttSucceeded({ text: '텍스트', sttRawText: '텍스트', failed: false });
  store.submit();
  useTurnStore.getState().rerecord();
  expect(useTurnStore.getState().phase).toBe('SUBMITTED');
});

test('failed=true SttResult는 REVIEW로 가지 않고 RECORDING 복귀 (계약 불변 조건 1의 UI 측)', () => {
  const store = useTurnStore.getState();
  store.characterAudioEnded();
  store.stopRecording();
  store.sttSucceeded({ text: '', sttRawText: '...', failed: true });
  expect(useTurnStore.getState().phase).toBe('RECORDING');
  expect(useTurnStore.getState().sttText).toBeNull();
});
