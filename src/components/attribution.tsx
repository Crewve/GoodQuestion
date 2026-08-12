// 타입캐스트 출처 표기 (T061, FR-013·SC-005) — 무료 플랜 의무 크레딧, 시연 화면 공통 푸터.
// TTS 음성이 재생되는 화면(이야기 진행 play — 학습완료 activity·complete에도 부착 가능하도록 공용)에
// 상시 노출한다. Server/Client 어느 쪽에서도 사용 가능(순수 마크업).
export function Attribution() {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-center bg-transparent">
      {/* 크레딧 문구는 아이 조작·학습 요소가 아니라 18px 하한 예외 — 대비 확보를 위해 ink/60 사용 */}
      <p className="text-sm text-ink/60">음성제작: 타입캐스트 (typecast.ai)</p>
    </footer>
  );
}
