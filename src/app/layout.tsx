import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// 본문: PretendardGOV 서브셋 4웨이트 (src/fonts/README.md — SIL OFL 1.1)
const pretendardGov = localFont({
  src: [
    { path: "../fonts/PretendardGOV-Regular.subset.woff2", weight: "400", style: "normal" },
    { path: "../fonts/PretendardGOV-Medium.subset.woff2", weight: "500", style: "normal" },
    { path: "../fonts/PretendardGOV-SemiBold.subset.woff2", weight: "600", style: "normal" },
    { path: "../fonts/PretendardGOV-Bold.subset.woff2", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-pretendard-gov",
});

// 헤드라인: Cafe24 Ssurround 라운드체 단일 파일 — 400~700 어느 웨이트 지정에도 같은 글리프 사용
// (피그마 표기는 Jua이나 전달본 기준 채택 — R-14, 기획 확정 시 교체)
const cafe24Ssurround = localFont({
  src: "../fonts/Cafe24Ssurround-v2.0.woff2",
  weight: "400 700",
  display: "swap",
  variable: "--font-cafe24-ssurround",
});

export const metadata: Metadata = {
  title: "굿퀘스천",
  description: "아이가 동화 캐릭터와 음성으로 대화하며 생각하는 힘을 기르는 서비스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${pretendardGov.variable} ${cafe24Ssurround.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
