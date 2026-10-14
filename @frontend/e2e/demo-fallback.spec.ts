import { expect, test } from '@playwright/test';

// playwright.config 의 dev 서버는 연결 안 되는 백엔드 주소로 떠서, API 중계 라우트가 데모 데이터로 응답함
test.describe('백엔드에 연결할 수 없을 때', () => {
  test('메인에 데모 안내와 공연 목록이 나온다', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('데모 데이터를 보여주고 있습니다')).toBeVisible();
    await expect(page.getByText('뮤지컬 <엘리자벳>').first()).toBeVisible();
    // 메인 배너는 판매 시작 전 공연(엘리자벳)을 카운트다운과 함께 먼저 보여줌
    await expect(page.getByText('티켓 오픈까지')).toBeVisible();
  });

  test('공연 목록 페이지에서 검색할 수 있다', async ({ page }) => {
    await page.goto('/shows');

    await expect(page.getByText('연극 <베니스의 상인>')).toBeVisible();
    const search = page.getByPlaceholder('공연·전시명 또는 지역명을 입력하세요');
    await search.fill('베토벤');
    await search.press('Enter');
    await expect(page.getByText('뮤지컬 <베토벤>')).toBeVisible();
    await expect(page.getByText('연극 <베니스의 상인>')).toBeHidden();
  });

  test('판매 중 공연은 회차 선택, 오픈 예정 공연은 카운트다운이 나온다', async ({ page }) => {
    await page.goto('/shows/1');
    await expect(page.locator('aside').getByText('관람일')).toBeVisible();
    await expect(page.locator('aside').getByText(/R석 \d+/)).toBeVisible();

    await page.goto('/shows/2');
    await expect(
      page.locator('aside').getByRole('button', { name: /^남은 시간 \d{2}:\d{2}:\d{2}$/ }),
    ).toBeVisible();
  });

  test('예매하기를 누르면 로그인 화면에서 이용 불가 안내가 나온다', async ({ page }) => {
    await page.goto('/shows/1');
    await page.locator('aside').getByRole('button', { name: '예매하기' }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('지금은 로그인할 수 없습니다')).toBeVisible();
    // 로그인 버튼은 꺼진 백엔드 주소로 이동하므로 누를 수 없게 막혀 있어야 함
    await expect(page.locator('[inert]')).toContainText('카카오로 계속하기');
  });
});
