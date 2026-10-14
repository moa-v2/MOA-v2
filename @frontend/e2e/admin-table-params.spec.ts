import { expect, test, type Page } from '@playwright/test';

/**
 * 관리자 목록 API 를 가로채 가짜 목록으로 응답하고, 백엔드로 간 조회 조건을 기록함
 * (관리자 확인은 서버의 proxy.ts 가 하므로 가짜 백엔드로 관리자 로그인을 해 둠)
 */
async function mockAdminList(page: Page, path: string, item: Record<string, unknown>) {
  await page.request.get('/api/auth/callback?code=code-admin', { maxRedirects: 0 });
  const requests: URLSearchParams[] = [];
  await page.route(
    (url) => url.pathname === path,
    (route) => {
      requests.push(new URL(route.request().url()).searchParams);
      return route.fulfill({
        json: {
          success: true,
          data: { content: [item], totalPages: 5, totalElements: 50 },
          message: null,
        },
      });
    },
  );
  const lastRequest = () => Object.fromEntries(requests.at(-1) ?? []);
  return { requests, lastRequest };
}

const SHOW = {
  id: 1,
  title: '테스트 공연',
  status: 'ON_SALE',
  saleStatus: 'ALLOWED',
  genre: 'MUSICAL',
  schedules: [],
  salePeriod: null,
};

const query = (page: Page) => Object.fromEntries(new URL(page.url()).searchParams);
const nextPageButton = (page: Page) => page.locator('button:has(svg.lucide-chevron-right)');

test.describe('관리자 목록 조건을 주소에 저장', () => {
  test('필터·페이지가 주소에 남아 새로고침·뒤로 가기에도 유지된다', async ({ page }) => {
    const api = await mockAdminList(page, '/api/v1/admin/shows', SHOW);
    await page.goto('/admin/shows');
    await expect(page.getByText('1 / 5')).toBeVisible();
    expect(api.lastRequest()).toEqual({ page: '0', size: '10' });

    await page.getByRole('button', { name: '장르 필터' }).click();
    await page.getByRole('menuitemcheckbox', { name: '뮤지컬' }).click();
    await expect.poll(() => query(page)).toEqual({ genre: 'MUSICAL' });

    await nextPageButton(page).click();
    await expect.poll(() => query(page)).toEqual({ page: '2', genre: 'MUSICAL' });
    await expect.poll(() => api.lastRequest()).toEqual({ page: '1', size: '10', genre: 'MUSICAL' });

    await page.reload();
    await expect(page.getByText('2 / 5')).toBeVisible();
    expect(api.lastRequest()).toEqual({ page: '1', size: '10', genre: 'MUSICAL' });

    await page.goBack();
    await expect.poll(() => query(page)).toEqual({ genre: 'MUSICAL' });
    await expect(page.getByText('1 / 5')).toBeVisible();
    await expect.poll(() => api.lastRequest()).toEqual({ page: '0', size: '10', genre: 'MUSICAL' });
  });

  test('정렬은 주소에 열.방향으로 남고 백엔드에는 열,방향으로 보낸다', async ({ page }) => {
    const api = await mockAdminList(page, '/api/v1/admin/shows', SHOW);
    await page.goto('/admin/shows');

    await page.getByRole('columnheader', { name: '제목' }).getByRole('button').click();
    await expect.poll(() => query(page)).toEqual({ sort: 'title.asc' });
    await expect.poll(() => api.lastRequest().sort).toBe('title,asc');
  });

  test('초기화하면 모든 조건이 기본값이 되고, 뒤로 가기로 직전 조건에 돌아간다', async ({
    page,
  }) => {
    const api = await mockAdminList(page, '/api/v1/admin/shows', SHOW);
    const reset = page.getByRole('button', { name: '초기화' });

    await page.goto('/admin/shows');
    await expect(page.getByText('1 / 5')).toBeVisible();
    // 조건이 없으면 버튼을 보이지 않음
    await expect(reset).toBeHidden();

    await page.goto('/admin/shows?page=3&sort=title.asc&genre=MUSICAL&q=베토벤');
    await expect(page.getByPlaceholder('검색어를 입력하세요')).toHaveValue('베토벤');
    await reset.click();
    await expect.poll(() => query(page)).toEqual({});
    await expect.poll(() => api.lastRequest()).toEqual({ page: '0', size: '10' });
    await expect(page.getByPlaceholder('검색어를 입력하세요')).toHaveValue('');
    await expect(reset).toBeHidden();

    await page.goBack();
    await expect
      .poll(() => query(page))
      .toEqual({ page: '3', sort: 'title.asc', genre: 'MUSICAL', q: '베토벤' });
  });

  test('주소에 이상한 값이 오면 기본값으로 조회한다', async ({ page }) => {
    const api = await mockAdminList(page, '/api/v1/admin/shows', SHOW);
    // 정렬 필드는 백엔드가 그대로 쓰므로 허용하지 않은 열은 보내지 않아야 함
    await page.goto('/admin/shows?page=-3&size=999&sort=password.asc&genre=HACK&status=ON_SALE');

    await expect(page.getByText('1 / 5')).toBeVisible();
    expect(api.lastRequest()).toEqual({ page: '0', size: '10', showStatus: 'ON_SALE' });
  });

  test('회원 검색어는 개인정보라 주소에 남기지 않는다', async ({ page }) => {
    const api = await mockAdminList(page, '/api/v1/admin/users', {
      id: 1,
      name: '홍길동',
      status: 'ACTIVE',
      gender: 'MALE',
      email: 'hong@moa.test',
      role: 'USER',
      socialProvider: 'KAKAO',
    });
    await page.goto('/admin/user');

    const search = page.getByPlaceholder('검색어를 입력하세요');
    await search.fill('hong@moa.test');
    await search.press('Enter');
    await expect.poll(() => api.lastRequest().keyword).toBe('hong@moa.test');

    await page.getByRole('button', { name: '성별 필터' }).click();
    await page.getByRole('menuitemcheckbox', { name: '여', exact: true }).click();
    await expect.poll(() => query(page)).toEqual({ gender: 'FEMALE' });
    // 필터를 바꿔도 검색 조건은 유지
    await expect
      .poll(() => api.lastRequest())
      .toMatchObject({ keyword: 'hong@moa.test', gender: 'FEMALE' });
    expect(page.url()).not.toContain('hong');

    // 초기화는 주소에 없는 검색어까지 비움(기본 조건은 처음에 받아 둔 캐시를 씀)
    const before = api.requests.length;
    await page.getByRole('button', { name: '초기화' }).click();
    await expect.poll(() => query(page)).toEqual({});
    await expect(search).toHaveValue('');
    await expect(page.getByRole('button', { name: '초기화' })).toBeHidden();
    // 검색어만 먼저 비운 중간 조건(성별 필터만 남은 조회)이 나가지 않아야 함
    expect(api.requests.slice(before).map((params) => params.get('gender'))).not.toContain(
      'FEMALE',
    );
  });
});
