import { expect, test } from '@playwright/test';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// 서버 LocalDateTime 형식(KST, 오프셋 없음)
const toKst = (ms: number) => new Date(ms + 9 * HOUR).toISOString().slice(0, 19);
const ok = (data: unknown) => ({ success: true, data, message: null });

function makeShow(id: number, title: string, saleEndMs: number, viewCount: number) {
  const saleStartMs = saleEndMs - 60 * DAY;
  return {
    id,
    title,
    genre: 'MUSICAL',
    status: saleEndMs < Date.now() ? 'ENDED' : 'ON_SALE',
    saleStatus: 'ALLOWED',
    posterUrl: '',
    location: { region: 'SEOUL', venue: '테스트 아트센터', hallName: '대극장' },
    salePeriod: { startDate: toKst(saleStartMs), endDate: toKst(saleEndMs) },
    createdAt: toKst(saleStartMs),
    viewCount,
    startDate: toKst(saleStartMs).slice(0, 10),
    endDate: toKst(saleEndMs).slice(0, 10),
  };
}

test('메인 배너에는 판매가 끝난 공연이 나오지 않는다', async ({ page }) => {
  const now = Date.now();
  // 조회수 순서로 내려오므로 끝난 공연이 앞에 있어도 걸러져야 함
  const shows = [
    makeShow(1, '종료된 공연 A', now - DAY, 9000),
    makeShow(2, '판매 중 공연 B', now + 30 * DAY, 100),
  ];
  await page.route(
    (url) => url.pathname === '/api/v1/shows',
    (route) =>
      route.fulfill({
        json: ok({
          content: shows,
          page: 0,
          size: 20,
          totalElements: shows.length,
          totalPages: 1,
          first: true,
          last: true,
        }),
      }),
  );
  await page.goto('/');

  const slideTitles = page.getByRole('heading', { level: 2 });
  await expect(slideTitles.filter({ hasText: '판매 중 공연 B' })).toBeVisible();
  await expect(slideTitles.filter({ hasText: '종료된 공연 A' })).toHaveCount(0);
});
