import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // next dev 가 AI 도구용 AGENTS.md 를 자동으로 만들지 않게 함
  agentRules: false,
  // multipart 대용량 본문 (API 요청당 합계 50MB)
  experimental: {
    proxyClientMaxBodySize: '50mb',
  },
  images: {
    remotePatterns: [
      // 로컬 개발 환경
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8080',
      },
      // 메인 배너 외부 이미지
      {
        protocol: 'https',
        hostname: 'ticketimage.interpark.com',
      },
      // 외부 이미지 CDN (CloudFront)
      {
        protocol: 'https',
        hostname: 'd23ve22iivj7kg.cloudfront.net',
      },
      // 백엔드 서버 도메인 (환경 변수가 설정된 경우만)
      ...(process.env.NEXT_PUBLIC_BACKEND_URL
        ? [
            {
              protocol: 'https' as const,
              hostname: process.env.NEXT_PUBLIC_BACKEND_URL,
            },
          ]
        : []),
    ],
  },
};

export default nextConfig;
