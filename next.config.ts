import type { NextConfig } from "next";
import storageAssets from "./fixtures/storage-assets.json";

const nextConfig: NextConfig = {
  images: {
    // Storage 공개 버킷 원본이 0.75~2MB PNG(썸네일 1448×1086 등)라 표시 크기로 최적화한다 (T069, E2E 항목 3·7)
    remotePatterns: [new URL(`${storageAssets.base_url}/**`)],
  },
};

export default nextConfig;
