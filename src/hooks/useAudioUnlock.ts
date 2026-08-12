'use client';
// 오디오 언락 훅 (T034, R-15) — iPad Safari 자동재생 정책 대응: 사용자 제스처 없이는 audio.play()가
// 거부되므로, 첫 pointerdown에서 AudioContext를 열고 무음 버퍼를 1회 재생해 이후 프로그래매틱 재생을 허용시킨다.
// 언락은 페이지 수명 동안 1회면 충분 — 모듈 전역 플래그를 외부 스토어(useSyncExternalStore)로 구독해
// 여러 훅 인스턴스가 같은 언락 상태를 공유한다(effect 내 동기 setState 금지 규칙 준수).
import { useCallback, useEffect, useSyncExternalStore } from 'react';

let unlockedGlobal = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function markUnlocked() {
  unlockedGlobal = true;
  listeners.forEach((listener) => listener());
}

function tryUnlock(): boolean {
  try {
    type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };
    const Ctx = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctx) return true; // AudioContext 미지원 환경은 언락 개념 자체가 없음
    const ctx = new Ctx();
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, 22050); // 1샘플 무음
    source.connect(ctx.destination);
    source.start(0);
    void ctx.resume();
    return true;
  } catch {
    return false; // 다음 제스처에서 재시도
  }
}

export function useAudioUnlock(): { unlocked: boolean; unlock: () => void } {
  const unlocked = useSyncExternalStore(
    subscribe,
    () => unlockedGlobal,
    () => false, // SSR 스냅숏 — 언락은 브라우저 제스처 이후에만 참
  );

  const unlock = useCallback(() => {
    if (unlockedGlobal) return;
    if (tryUnlock()) markUnlocked();
  }, []);

  useEffect(() => {
    if (unlockedGlobal) return;
    const handler = () => unlock();
    window.addEventListener('pointerdown', handler, { once: true, capture: true });
    return () => window.removeEventListener('pointerdown', handler, { capture: true });
  }, [unlock]);

  return { unlocked, unlock };
}
