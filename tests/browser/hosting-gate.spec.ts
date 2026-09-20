import { test, expect } from '@playwright/test';

// A deployment that serves the built files without the Node backend answers /api/* with the SPA
// page. The demo must refuse to open rather than treat an unanswerable check as "no password".
test('a backend-less deployment refuses to open instead of exposing the demo', async ({ page }) => {
  await page.route('**/api/demo-session', route => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><html><body><div id="app"></div></body></html>',
  }));
  await page.goto('/applicant');
  await expect(page.locator('.hosting-gate')).toContainText('Demonstration unavailable');
  await expect(page.locator('.hosting-gate')).toContainText('npm run serve');
  // The workspace must not be reachable behind the failed check.
  await expect(page.locator('#interview-app')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Try the completed applicant demo' })).toHaveCount(0);
});

test('an unreachable or malformed session check is treated the same way', async ({ page }) => {
  await page.route('**/api/demo-session', route => route.abort());
  await page.goto('/applicant');
  await expect(page.locator('.hosting-gate')).toContainText('Demonstration unavailable');

  await page.unroute('**/api/demo-session');
  await page.route('**/api/demo-session', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ required: 'yes' }),
  }));
  await page.goto('/applicant');
  await expect(page.locator('.hosting-gate')).toContainText('Demonstration unavailable');
});

test('a healthy backend that reports no password still opens normally', async ({ page }) => {
  await page.route('**/api/demo-session', route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ required: false, authenticated: false }),
  }));
  await page.goto('/applicant');
  await expect(page.getByRole('button', { name: 'Try the completed applicant demo' })).toBeVisible();
  await expect(page.locator('.hosting-gate')).toHaveCount(0);
});
