import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const DAY = 24 * 60 * 60 * 1000;
const SHOW_ID = 1;

/** 서버 LocalDateTime 형식(KST, 오프셋 없음) */
const toKst = (ms: number) => new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 19);
const toKstDate = (ms: number) => toKst(ms).slice(0, 10);
const ok = <T>(data: T) => ({ success: true, data, message: null });

/**
 * 백엔드 없이 돌도록 공연 상세·잔여석·로그인 확인 응답을 가짜로 채움
 * /api/server-time 은 가로채지 않아 진짜 Next 서버 시각으로 동기화됨
 */
async function mockShow(context: BrowserContext, saleStartDate: string) {
  const now = Date.now();
  const tomorrow = toKstDate(now + DAY);
  const detail = {
    id: SHOW_ID,
    title: 'E2E 테스트 공연',
    genre: 'MUSICAL',
    status: 'WAITING',
    saleStatus: 'ALLOWED',
    posterUrl: '',
    location: { region: 'SEOUL', venue: '테스트 아트센터', hallName: '대극장' },
    salePeriod: { startDate: saleStartDate, endDate: toKst(now + 60 * DAY) },
    createdAt: toKst(now),
    viewCount: 0,
    startDate: tomorrow,
    endDate: toKstDate(now + 60 * DAY),
    schedules: [{ keyId: 101, date: tomorrow, time: '19:30', session: 1 }],
    detailImageUrls: [],
    runningTime: '150분',
    cast: '테스트 배우',
  };
  const seats = detail.schedules.map(({ keyId, date, time }) => ({
    keyId,
    date,
    time,
    isSoldOut: false,
    totalSeats: 100,
    remainingSeats: 100,
    seatGrades: [{ sectionName: 'R', price: 100000, remainingSeats: 100, totalSeats: 100 }],
  }));

  await context.route('**/api/v1/**', (route) => {
    const { pathname } = new URL(route.request().url());
    const headers = { date: new Date().toUTCString() };
    if (pathname === `/api/v1/shows/${SHOW_ID}`) {
      return route.fulfill({ headers, json: ok(detail) });
    }
    if (pathname === `/api/v1/shows/${SHOW_ID}/schedules`) {
      return route.fulfill({ headers, json: ok(seats) });
    }
    if (pathname === '/api/v1/users/me') {
      return route.fulfill({
        status: 401,
        headers,
        json: { success: false, data: null, message: '인증이 필요합니다.' },
      });
    }
    return route.fulfill({ headers, json: ok(null) });
  });
}

const sidebar = (page: Page) => page.locator('aside');
const countdownButton = (page: Page) =>
  sidebar(page).getByRole('button', { name: /^남은 시간 \d{2}:\d{2}:\d{2}$/ });

test.describe('티켓 오픈 카운트다운', () => {
  test('24시간 넘게 남으면 D-n 과 비활성 예매하기', async ({ page, context }) => {
    await mockShow(context, `${toKstDate(Date.now() + 3 * DAY)}T12:00:00`);
    await page.goto(`/shows/${SHOW_ID}`);

    await expect(sidebar(page).getByText('D-3', { exact: true })).toBeVisible();
    await expect(sidebar(page).getByRole('button', { name: '예매하기' })).toBeDisabled();
  });

  test('24시간 안이면 남은 시간이 시:분:초로 줄어든다', async ({ page, context }) => {
    await mockShow(context, toKst(Date.now() + 2 * 60 * 60 * 1000));
    await page.goto(`/shows/${SHOW_ID}`);

    const button = countdownButton(page);
    await expect(button).toHaveText(/^남은 시간 0[12]:\d{2}:\d{2}$/);
    const first = (await button.textContent()) ?? '';
    await expect(button).not.toHaveText(first);
  });

  test('기기 시계가 5분 빨라도 서버 시각 기준으로 세고 0초에 회차 선택으로 바뀐다', async ({
    page,
    context,
  }) => {
    const openAt = Math.ceil((Date.now() + 8_000) / 1000) * 1000;
    await page.clock.install({ time: Date.now() + 5 * 60 * 1000 });
    await mockShow(context, toKst(openAt));
    await page.goto(`/shows/${SHOW_ID}`);

    // 기기 시계 기준이었다면 이미 열려 있어야 함
    await expect(countdownButton(page)).toBeVisible();
    await sidebar(page).getByText('관람일').waitFor({ timeout: 15_000 });
    const switchedAt = Date.now();
    expect(switchedAt).toBeGreaterThanOrEqual(openAt - 500);
    expect(switchedAt).toBeLessThan(openAt + 1_500);
  });

  test('결제 카운트다운은 마감 시각 기준으로 줄어든다', async ({ page, context }) => {
    await mockShow(context, toKst(Date.now() + DAY));
    // 결제 화면은 서버(proxy.ts)가 로그인을 확인하므로 가짜 백엔드로 로그인해 둠
    await page.request.get('/api/auth/callback?code=code-user', { maxRedirects: 0 });
    await page.goto(
      `/shows/reservation/payment?remainingSeconds=65&expiresAt=${Date.now() + 65_000}`,
    );

    const label = page.getByText(/^결제 가능 시간 \d+:\d{2}$/);
    await expect(label).toHaveText(/1:0[0-5]$/);
    const first = (await label.textContent()) ?? '';
    await expect(label).not.toHaveText(first);
  });
});

test.describe('해외 타임존', () => {
  test.use({ timezoneId: 'America/New_York' });

  test('서버 일시를 한국 시간으로 읽는다', async ({ page, context }) => {
    // 기기 타임존으로 읽으면 13시간 밀려 2시간이 아니라 15시간 남은 것으로 보임
    await mockShow(context, toKst(Date.now() + 2 * 60 * 60 * 1000));
    await page.goto(`/shows/${SHOW_ID}`);

    await expect(countdownButton(page)).toHaveText(/^남은 시간 0[12]:\d{2}:\d{2}$/);
  });
});
