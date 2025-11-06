import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  reactStrictMode: false, // Strict Mode 비활성화
  // Capacitor는 서버 모드로 실행 (localhost 서버 사용)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
