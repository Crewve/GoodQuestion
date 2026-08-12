// 마이페이지 하위 정적 화면 공용 아코디언 (T058, 기능명세서 3.3~3.5 "항목 클릭 시 내용 표시").
// 네이티브 <details>/<summary>라 클라이언트 JS 불필요 — Server Component에서 그대로 사용.
import type { ReactNode } from 'react';

export function AccordionItem({ title, meta, children }: { title: string; meta?: string; children: ReactNode }) {
  return (
    <details className="group border-b border-ink/5 last:border-b-0">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden active:bg-base">
        <span className="min-w-0">
          <span className="block text-lg font-semibold text-ink">{title}</span>
          {meta && <span className="block text-sm text-ink/50">{meta}</span>}
        </span>
        <span aria-hidden className="shrink-0 text-ink/30 transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="whitespace-pre-line px-5 pb-5 text-base leading-relaxed text-ink/80">{children}</div>
    </details>
  );
}

/** 목록 컨테이너 — 카드 한 장에 항목들을 담는다 (3.2 카드 관례와 동일한 흰 배경 라운드) */
export function AccordionList({ children }: { children: ReactNode }) {
  return <section className="overflow-hidden rounded-3xl bg-white">{children}</section>;
}
