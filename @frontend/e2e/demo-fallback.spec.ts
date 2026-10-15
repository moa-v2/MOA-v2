import { expect, test } from '@playwright/test';

// playwright.config 의 dev 서버는 연결 안 되는 백엔드 주소로 떠서, API 중계 라우트가 데모 데이터로 응답함
test.describe('백엔드에 연결할 수 없을 때', () => {
  test('메인에 데모 안내와 공연 목록이 나온다', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('데모 데이터를 보여주고 있습니다')).toBeVisible();
    await expect(page.getByText('뮤지컬 <오페라의 유령>').first()).toBeVisible();
    // 메인 배너는 판매 시작 전 공연을 카운트다운(또는 D-day)과 함께 먼저 보여줌
    await expect(page.getByText('티켓 오픈까지').first()).toBeVisible();
  });

  test('메인에 티켓 오픈 예정 공연이 오픈이 가까운 순서로 나온다', async ({ page }) => {
    await page.goto('/');

    // 데모 공연: 오페라의 유령(다음 20시), 호두까기인형(3일 뒤 11시), 캣츠(6일 뒤 14시)
    const items = page.getByRole('region', { name: '티켓 오픈 예정' }).getByRole('listitem');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText('뮤지컬 <오페라의 유령>');
    await expect(items.nth(0)).toContainText(/\d{2}:\d{2}:\d{2}$/);
    await expect(items.nth(1)).toContainText('2026 유니버설발레단 <호두까기인형>');
    await expect(items.nth(1)).toContainText('D-3');
    await expect(items.nth(2)).toContainText('뮤지컬 <캣츠> 내한공연 - 대구');
    await expect(items.nth(2)).toContainText('D-6');

    await expect(
      page.getByRole('contentinfo').getByRole('link', { name: 'GitHub' }),
    ).toHaveAttribute('href', 'https://github.com/moa-v2/MOA-v2');
  });

  test('공연 목록 페이지에서 검색할 수 있다', async ({ page }) => {
    await page.goto('/shows');

    await expect(page.getByText('연극 <클로저>')).toBeVisible();
    const search = page.getByPlaceholder('공연·전시명 또는 지역명을 입력하세요');
    // 지역명으로도 찾음(사의 찬미는 제목에 '춘천'만 있고 지역은 강원)
    await search.fill('강원');
    await search.press('Enter');
    await expect(page.getByText('뮤지컬 <사의 찬미> - 춘천')).toBeVisible();
    await expect(page.getByText('연극 <클로저>')).toBeHidden();
  });

  test('공연 상세 사이드바가 판매 중·오픈 예정·종료에 맞게 나온다', async ({ page }) => {
    // 개발 서버는 스트리밍한 조각이 숨은 사본으로 남을 때가 있어 보이는 사이드바(complementary)만 찾음
    await page.goto('/shows/103');
    await expect(page.getByRole('complementary').getByText('관람일')).toBeVisible();
    await expect(page.getByRole('complementary').getByText(/R석 \d+/)).toBeVisible();

    await page.goto('/shows/102');
    await expect(
      page
        .getByRole('complementary')
        .getByRole('button', { name: /^남은 시간 \d{2}:\d{2}:\d{2}$/ }),
    ).toBeVisible();

    await page.goto('/shows/101');
    await expect(
      page.getByRole('complementary').getByText('해당 공연의 모든 회차가 종료되었습니다.'),
    ).toBeVisible();
  });

  test('예매하기를 누르면 로그인 화면에서 이용 불가 안내가 나온다', async ({ page }) => {
    await page.goto('/shows/103');
    await page.getByRole('complementary').getByRole('button', { name: '예매하기' }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('지금은 로그인할 수 없습니다')).toBeVisible();
    // 로그인 버튼은 꺼진 백엔드 주소로 이동하므로 누를 수 없게 막혀 있어야 함
    await expect(page.locator('[inert]')).toContainText('카카오로 계속하기');
  });
});
