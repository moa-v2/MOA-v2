import { expect, test, type Page, type Request } from '@playwright/test';

const ADMIN = {
  name: '관리자',
  email: 'admin@moa.test',
  role: 'ADMIN',
  provider: 'kakao',
  providerId: '1',
};
const DRAFT_KEY = `moa:draft:show-create:${ADMIN.email}`;
const SEAT_MAPS = [
  ['테스트 아트센터', '대극장'],
  ['테스트 아트센터', '소극장'],
  ['두번째 극장', '큰홀'],
].map(([venueName, hallName], index) => ({
  seatMapId: String(index + 1),
  region: 'SEOUL',
  venueName,
  hallName,
  createdAt: '2026-10-01T00:00:00',
  updatedAt: '2026-10-01T00:00:00',
}));
// 수정 화면용 예매 대기 공연(장소·공연장을 바꿀 수 있는 상태)
const EDIT_SHOW = {
  id: 7,
  title: '수정할 공연',
  genre: 'MUSICAL',
  region: 'SEOUL',
  venueName: '테스트 아트센터',
  hallName: '대극장',
  runningTime: '150분',
  cast: '테스트 배우',
  status: 'WAITING',
  saleStatus: 'ALLOWED',
  saleStartDate: '2026-11-10T10:00:00',
  saleEndDate: '2026-12-01T17:30:00',
  posterUrl: 'https://d23ve22iivj7kg.cloudfront.net/posters/2026/0717/e2e.png',
  detailImageUrls: [],
  detailImages: [],
  schedules: [
    {
      scheduleId: 1,
      showDate: '2026-12-01',
      showTime: '19:30',
      ticketOpenTime: '2026-11-20T10:00:00',
      reservationCount: 0,
    },
  ],
  seatPrices: [],
  createdAt: '2026-10-01T00:00:00',
  updatedAt: '2026-10-01T00:00:00',
};
// 1x1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const ok = (data: unknown) => ({ success: true, data, message: null });

/** 관리자로 로그인하고(가짜 백엔드) 로그인 사용자·좌석 목록·공연 등록 API 를 가짜로 채움 */
async function setUpAdmin(page: Page) {
  await page.request.get('/api/auth/callback?code=code-admin', { maxRedirects: 0 });
  await page.route(
    (url) => url.pathname === '/api/v1/users/me',
    (route) => route.fulfill({ json: ok(ADMIN) }),
  );
  await page.route(
    (url) => url.pathname === '/api/v1/admin/seat-maps',
    (route) =>
      route.fulfill({
        json: ok({ content: SEAT_MAPS, totalPages: 1, totalElements: SEAT_MAPS.length }),
      }),
  );
  await page.route(
    (url) => url.pathname === `/api/v1/admin/shows/${EDIT_SHOW.id}`,
    (route) => route.fulfill({ json: ok(EDIT_SHOW) }),
  );
  await page.route(
    (url) => url.pathname === '/api/v1/admin/shows',
    (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ json: ok({ showId: 99 }) })
        : route.fulfill({ json: ok({ content: [], totalPages: 0, totalElements: 0 }) }),
  );
}

/** 등록 화면에 들어오기 전에 임시저장을 넣어 둠 */
async function seedDraft(page: Page, savedAt: number, values: Record<string, unknown>) {
  await page.goto('/login');
  await page.evaluate(
    ([key, value]) => localStorage.setItem(key, value),
    [DRAFT_KEY, JSON.stringify({ savedAt, values })],
  );
}

const readDraft = (page: Page) => page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY);

/** 공연 저장 요청(multipart)의 data 필드(JSON) */
async function readSavedShow(request: Request) {
  const body = await new Response(new Uint8Array(request.postDataBuffer() ?? []), {
    headers: { 'content-type': request.headers()['content-type'] },
  }).formData();
  return JSON.parse(String(body.get('data')));
}

async function select(page: Page, triggerId: string, option: string) {
  await page.locator(`#${triggerId}`).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function fillBasics(page: Page) {
  // 클릭으로 시작해야 브라우저가 사용자 입력으로 보고 이탈 확인(beforeunload)을 띄움
  await page.locator('#title').click();
  await page.locator('#title').pressSequentially('임시저장 테스트 공연');
  await select(page, 'region', '서울');
  await select(page, 'venueName', '테스트 아트센터');
  await select(page, 'hallName', '대극장');
  await page.locator('#runningTime').fill('150분');
  await page.locator('input[name="schedules.0.showDate"]').fill('2026-12-01');
}

const dialog = (page: Page) => page.getByRole('alertdialog');
// 상단 경로에도 같은 이름의 링크가 있어 사이드바 것을 고름
const sidebarLink = (page: Page, name: string) =>
  page.locator('[data-sidebar="menu-button"]').getByText(name, { exact: true });

test.describe('공연 등록 임시저장', () => {
  test('입력하면 자동 임시저장되고, 다시 들어오면 이어서 작성할 수 있다', async ({ page }) => {
    await setUpAdmin(page);
    await page.goto('/admin/shows/upsert');
    await fillBasics(page);
    await expect(page.getByText(/^임시저장됨 \d{2}:\d{2}$/)).toBeVisible();

    // 새로고침 때 브라우저가 묻는 이탈 확인(beforeunload)은 수락
    page.on('dialog', (browserDialog) => browserDialog.accept());
    await page.reload();
    await expect(dialog(page)).toContainText('작성하던 공연이 있습니다');
    await expect(dialog(page).getByRole('heading', { name: '임시 저장' })).toBeVisible();
    await expect(dialog(page).getByText('첨부한 이미지는 저장되지 않습니다.')).toHaveClass(
      /text-destructive/,
    );
    await page.getByRole('button', { name: '이어서 작성' }).click();

    await expect(page.locator('#title')).toHaveValue('임시저장 테스트 공연');
    await expect(page.locator('#runningTime')).toHaveValue('150분');
    await expect(page.locator('input[name="schedules.0.showDate"]')).toHaveValue('2026-12-01');
    // 장소·공연장은 지역의 좌석 목록이 온 뒤에 다시 채워짐
    await expect(page.locator('#venueName')).toContainText('테스트 아트센터');
    await expect(page.locator('#hallName')).toContainText('대극장');
  });

  test('목록에 나갔다가 다시 들어와도 장소·공연장까지 이어서 작성된다', async ({ page }) => {
    // 같은 화면 안에서 이동하면 좌석 목록이 캐시에 있어 선택지와 값이 동시에 들어옴
    await setUpAdmin(page);
    await page.goto('/admin/shows/upsert');
    await fillBasics(page);
    await expect(page.getByText(/^임시저장됨 \d{2}:\d{2}$/)).toBeVisible();

    await sidebarLink(page, '공연 관리').click();
    await page.getByRole('button', { name: '나가기' }).click();
    await expect(page).toHaveURL('/admin/shows');
    await page.getByRole('button', { name: '공연 등록' }).click();
    await page.getByRole('button', { name: '이어서 작성' }).click();

    await expect(page.locator('#title')).toHaveValue('임시저장 테스트 공연');
    await expect(page.locator('#venueName')).toContainText('테스트 아트센터');
    await expect(page.locator('#hallName')).toContainText('대극장');
  });

  test('새로 작성을 고르면 임시저장을 지우고 빈 폼으로 시작한다', async ({ page }) => {
    await setUpAdmin(page);
    await seedDraft(page, Date.now() - 60 * 60 * 1000, { title: '어제 쓰던 공연' });
    await page.goto('/admin/shows/upsert');

    await expect(dialog(page)).toContainText('작성하던 공연이 있습니다');
    await page.getByRole('button', { name: '새로 작성' }).click();
    await expect(page.locator('#title')).toHaveValue('');
    expect(await readDraft(page)).toBeNull();
  });

  test('3일 지난 임시저장은 묻지 않고 지운다', async ({ page }) => {
    await setUpAdmin(page);
    await seedDraft(page, Date.now() - 4 * 24 * 60 * 60 * 1000, { title: '오래된 공연' });
    await page.goto('/admin/shows/upsert');

    await expect(page.locator('#title')).toBeVisible();
    await expect.poll(() => readDraft(page)).toBeNull();
    await expect(dialog(page)).toBeHidden();
  });

  test('임시저장 버튼은 기다리지 않고 바로 저장한다', async ({ page }) => {
    await setUpAdmin(page);
    await page.goto('/admin/shows/upsert');
    await page.locator('#title').fill('버튼으로 저장');

    await page.getByRole('button', { name: '임시저장' }).click();
    // 자동 저장(1초)보다 먼저 저장돼 있어야 함
    expect(JSON.parse((await readDraft(page)) ?? '{}').values?.title).toBe('버튼으로 저장');
    await expect(page.getByText(/^임시저장됨 \d{2}:\d{2}$/)).toBeVisible();
  });

  test('등록하면 예매 종료일까지 보내고, 성공하면 임시저장을 지운다', async ({ page }) => {
    await setUpAdmin(page);
    const saved = page.waitForRequest(
      (request) =>
        request.method() === 'POST' && new URL(request.url()).pathname === '/api/v1/admin/shows',
    );
    await page.goto('/admin/shows/upsert');
    await fillBasics(page);
    await select(page, 'genre', '뮤지컬');
    await page.locator('#cast').fill('테스트 배우');
    await page.locator('input[name="schedules.0.showTime"]').fill('19:30');
    await page.locator('input[name="schedules.0.ticketOpenTime"]').fill('2026-11-20T10:00');
    await page.locator('#startDate').fill('2026-11-10T10:00');
    await page
      .locator('#poster')
      .setInputFiles({ name: 'poster.png', mimeType: 'image/png', buffer: PNG });
    await page
      .locator('#detail-images')
      .setInputFiles({ name: 'detail.png', mimeType: 'image/png', buffer: PNG });
    await expect.poll(() => readDraft(page)).not.toBeNull();

    await page.getByRole('button', { name: '등록', exact: true }).click();
    await dialog(page).getByRole('button', { name: '등록' }).click();
    await expect(page).toHaveURL('/admin/shows');
    expect(await readDraft(page)).toBeNull();
    // 마지막 공연(12/1 19:30)의 2시간 전
    expect((await readSavedShow(await saved)).salePeriod.endDate).toBe('2026-12-01T17:30');
  });
});

test.describe('공연 등록 이탈 경고', () => {
  test('입력이 있으면 사이드바로 나갈 때 확인한다', async ({ page }) => {
    await setUpAdmin(page);
    await page.goto('/admin/shows/upsert');
    await page.locator('#title').fill('나가기 전 확인');

    await sidebarLink(page, '공연 관리').click();
    await expect(dialog(page)).toContainText('작성 중인 내용은 임시저장되어');
    await expect(dialog(page).getByText('첨부한 이미지는 저장되지 않습니다.')).toHaveClass(
      /text-destructive/,
    );
    await page.getByRole('button', { name: '머무르기' }).click();
    await expect(page).toHaveURL('/admin/shows/upsert');
    await expect(page.locator('#title')).toHaveValue('나가기 전 확인');

    await sidebarLink(page, '공연 관리').click();
    await page.getByRole('button', { name: '나가기' }).click();
    await expect(page).toHaveURL('/admin/shows');
  });

  test('입력이 없으면 묻지 않고 이동한다', async ({ page }) => {
    await setUpAdmin(page);
    await page.goto('/admin/shows/upsert');
    await expect(page.locator('#title')).toBeVisible();

    await sidebarLink(page, '공연 관리').click();
    await expect(page).toHaveURL('/admin/shows');
  });

  test('이전 버튼과 브라우저 뒤로 가기도 확인한다', async ({ page }) => {
    await setUpAdmin(page);
    await page.goto('/admin/shows');
    await page.getByRole('button', { name: '공연 등록' }).click();
    await expect(page).toHaveURL('/admin/shows/upsert');
    await page.locator('#title').fill('뒤로 가기 전 확인');

    await page.getByRole('button', { name: '이전' }).click();
    await page.getByRole('button', { name: '머무르기' }).click();
    await expect(page).toHaveURL('/admin/shows/upsert');

    // 브라우저 뒤로 가기(Navigation API 로 취소하고 확인)
    await page.goBack({ timeout: 3000 }).catch(() => null);
    await expect(dialog(page)).toContainText('작성 중인 내용은 임시저장되어');
    await page.getByRole('button', { name: '머무르기' }).click();
    await expect(page).toHaveURL('/admin/shows/upsert');

    await page.goBack({ timeout: 3000 }).catch(() => null);
    await page.getByRole('button', { name: '나가기' }).click();
    await expect(page).toHaveURL('/admin/shows');
  });

  test('탭을 닫거나 새로고침하면 브라우저가 확인한다', async ({ page }) => {
    await setUpAdmin(page);
    await page.goto('/admin/shows/upsert');
    await page.locator('#title').click();
    await page.locator('#title').pressSequentially('닫기 전 확인');

    const browserDialog = page.waitForEvent('dialog');
    await page.close({ runBeforeUnload: true });
    const shown = await browserDialog;
    expect(shown.type()).toBe('beforeunload');
    await shown.dismiss();
    await expect(page.locator('#title')).toHaveValue('닫기 전 확인');
  });
});

test.describe('공연 수정 화면', () => {
  async function openEditForm(page: Page) {
    await setUpAdmin(page);
    await page.goto(`/admin/shows/upsert/${EDIT_SHOW.id}`);
    await expect(page.locator('#venueName')).toContainText('테스트 아트센터');
    await expect(page.locator('#hallName')).toContainText('대극장');
  }

  test('불러온 장소·공연장을 바꾸면 바꾼 값이 유지된다', async ({ page }) => {
    await openEditForm(page);
    await select(page, 'venueName', '두번째 극장');
    await select(page, 'hallName', '큰홀');

    // 공연장 선택지가 바뀌어도 서버 값으로 되돌리지 않는지 잠시 두고 확인
    await page.waitForTimeout(1000);
    await expect(page.locator('#venueName')).toContainText('두번째 극장');
    await expect(page.locator('#hallName')).toContainText('큰홀');
  });

  test('열기만 하고 바꾸지 않으면 묻지 않고 나간다', async ({ page }) => {
    await openEditForm(page);
    await sidebarLink(page, '공연 관리').click();
    await expect(page).toHaveURL('/admin/shows');
  });

  test('저장하면 바꾼 값과 예매 종료일(마지막 공연 2시간 전)을 보낸다', async ({ page }) => {
    await openEditForm(page);
    await page.route(
      (url) => url.pathname === `/api/v1/admin/shows/${EDIT_SHOW.id}`,
      (route) =>
        route.request().method() === 'PATCH'
          ? route.fulfill({ json: ok({ showId: EDIT_SHOW.id }) })
          : route.fallback(),
    );
    const saved = page.waitForRequest(
      (request) =>
        request.method() === 'PATCH' &&
        new URL(request.url()).pathname === `/api/v1/admin/shows/${EDIT_SHOW.id}`,
    );

    await page.locator('#title').fill('수정한 공연');
    await page.getByRole('button', { name: '수정', exact: true }).click();
    await dialog(page).getByRole('button', { name: '수정' }).click();
    await expect(page).toHaveURL('/admin/shows');

    const show = await readSavedShow(await saved);
    expect(show.title).toBe('수정한 공연');
    expect(show.salePeriod).toEqual({ startDate: '2026-11-10T10:00', endDate: '2026-12-01T17:30' });
  });
});
