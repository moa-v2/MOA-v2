import { expect, test, type Page } from '@playwright/test';

// playwright.config 의 가짜 백엔드(e2e/mock-backend.mjs)가 토큰 교환·재발급에 응답함
// - 교환 코드 code-user / code-admin → 해당 역할로 로그인
// - 갱신용 토큰 refresh-user / refresh-admin 은 재발급, 그 밖의 값은 거절

/** 백엔드가 소셜 로그인을 마치고 콜백으로 돌려보낸 상황 */
const finishSocialLogin = (page: Page, code: 'code-user' | 'code-admin') =>
  page.goto(`/api/auth/callback?code=${code}`);

const cookieNames = async (page: Page) =>
  (await page.context().cookies()).map((cookie) => cookie.name);

test.describe('서버 로그인 확인(proxy.ts)', () => {
  test('로그인 없이 마이페이지에 가면 화면을 내려주기 전에 로그인으로 보낸다', async ({ page }) => {
    const response = await page.request.get('/my-page/reservations?page=2', { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const location = new URL(response.headers().location, 'http://localhost');
    expect(`${location.pathname}${location.search}`).toBe(
      '/login?returnTo=%2Fmy-page%2Freservations%3Fpage%3D2',
    );
  });

  test('로그인하면 원래 보려던 화면으로 돌아간다', async ({ page }) => {
    await page.goto('/my-page/info');
    await expect(page).toHaveURL('/login?returnTo=%2Fmy-page%2Finfo');

    // 소셜 로그인 버튼은 로그인 시작 라우트에 돌아갈 주소를 넘기고, 라우트는 쿠키에 보관한 뒤 백엔드로 보냄
    const kakao = page.locator('a[href^="/api/auth/login?provider=kakao"]');
    await expect(kakao).toHaveAttribute(
      'href',
      '/api/auth/login?provider=kakao&returnTo=%2Fmy-page%2Finfo',
    );
    const start = await page.request.get((await kakao.getAttribute('href'))!, { maxRedirects: 0 });
    expect(start.headers().location).toMatch(/\/oauth2\/authorization\/kakao\?env=local$/);
    expect(await cookieNames(page)).toContain('returnTo');

    await finishSocialLogin(page, 'code-user');
    await expect(page).toHaveURL('/my-page/info');
    expect(await cookieNames(page)).toEqual(
      expect.arrayContaining(['accessToken', 'refreshToken']),
    );
    expect(await cookieNames(page)).not.toContain('returnTo');
  });

  test('다른 사이트 주소는 돌아갈 주소로 받지 않는다', async ({ page }) => {
    for (const returnTo of [
      '//evil.example',
      '/\\evil.example',
      'https://evil.example',
      '/api/v1/users/me',
    ]) {
      await page.request.get(
        `/api/auth/login?provider=kakao&returnTo=${encodeURIComponent(returnTo)}`,
        { maxRedirects: 0 },
      );
      expect(await cookieNames(page)).not.toContain('returnTo');
    }
    await finishSocialLogin(page, 'code-user');
    await expect(page).toHaveURL('/');
  });

  test('헤더의 로그인 링크는 지금 화면을 돌아갈 주소로 넘긴다', async ({ page }) => {
    await page.goto('/shows');
    await expect(page.getByRole('link', { name: '로그인' })).toHaveAttribute(
      'href',
      '/login?returnTo=%2Fshows',
    );
  });

  test('관리자가 아니면 관리자 화면 대신 홈에서 안내한다', async ({ page }) => {
    await finishSocialLogin(page, 'code-user');
    await page.goto('/admin');

    await expect(page.getByText('권한이 없습니다. 관리자만 접근 가능합니다.')).toBeVisible();
    await expect(page).toHaveURL('/');
  });

  test('관리자는 관리자 화면에 들어간다', async ({ page }) => {
    await finishSocialLogin(page, 'code-admin');
    const response = await page.request.get('/admin/shows', { maxRedirects: 0 });
    expect(response.status()).toBe(200);
  });

  test('로그인 토큰이 만료돼도 갱신용 토큰이 있으면 다시 발급해 들어간다', async ({ page }) => {
    await page
      .context()
      .addCookies([
        { name: 'refreshToken', value: 'refresh-user', domain: 'localhost', path: '/' },
      ]);
    await page.goto('/my-page/info');

    await expect(page).toHaveURL('/my-page/info');
    expect(await cookieNames(page)).toContain('accessToken');
  });

  test('갱신용 토큰이 거절되면 쿠키를 지우고 로그인으로 보낸다', async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: 'refreshToken', value: 'logged-out', domain: 'localhost', path: '/' }]);
    await page.goto('/my-page/info');

    await expect(page).toHaveURL('/login?returnTo=%2Fmy-page%2Finfo');
    expect(await cookieNames(page)).not.toContain('refreshToken');
  });
});
