'use client';
// 이야기 상세 히어로 이미지 (A5, 기능명세서 2.3 예외) — 로드 실패 시 플레이스홀더 박스로 폴백.
// onError는 함수 직렬화 제약으로 Client Component가 필요해 서버 페이지(page.tsx)에서 분리했다.
import { useState } from 'react';
import Image from 'next/image';

export function StoryHero({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    // 이미지 로딩 배경과 같은 크림색 박스 — 레이아웃(41dvh)을 그대로 유지해 아래 내용이 튀지 않게 한다
    return <div className="h-[41dvh] w-full shrink-0 bg-[#FFE8C9]" aria-hidden />;
  }
  return (
    <Image
      src={src}
      alt=""
      width={1448}
      height={1086}
      sizes="100vw"
      preload
      onError={() => setFailed(true)}
      className="h-[41dvh] w-full shrink-0 bg-[#FFE8C9] object-contain"
    />
  );
}
