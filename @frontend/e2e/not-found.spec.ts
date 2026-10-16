import { expect, test } from '@playwright/test';

test('없는 주소면 404 화면에서 메인·공연 목록으로 갈 수 있다', async ({ page }) => {
  const response = await page.goto('/no-such-page');

  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle('페이지를 찾을 수 없음 | MOA Place');
  await expect(page.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('link', { name: '메인으로' })).toHaveAttribute(
    'href',
    '/',
  );

  await page.getByRole('link', { name: '공연 둘러보기' }).click();
  await expect(page).toHaveURL(/\/shows$/);
});
