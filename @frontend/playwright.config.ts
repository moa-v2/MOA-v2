import { defineConfig, devices } from '@playwright/test';

// 3000 은 다른 앱이 쓰고 있으면 그 서버에 붙어 버리므로 전용 포트를 씀
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // E2E_VIDEO=on 이면 모든 테스트를 녹화(PR 첨부용)
    video: process.env.E2E_VIDEO === 'on' ? 'on' : 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next dev --port ${PORT}`,
    url: baseURL,
    // 연결 안 되는 백엔드 주소로 띄워, 실제 백엔드 상태와 상관없이 항상 데모 데이터로 응답하게 함
    env: { NEXT_PUBLIC_BACKEND_URL: 'http://127.0.0.1:59999' },
    // 이미 떠 있는 서버는 실제 백엔드에 붙어 있을 수 있어 재사용하지 않음
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
