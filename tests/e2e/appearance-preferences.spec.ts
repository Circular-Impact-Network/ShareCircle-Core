/**
 * E2E tests for Settings → Appearance preferences and the unified notification master row.
 *
 * These live in e2e rather than unit tests because Radix's Switch sets state from a ref
 * callback, which loops to "Maximum update depth exceeded" under both happy-dom and jsdom
 * with React 19. A real browser is the only place these render.
 */

import { test, expect, storageStatePaths } from './fixtures';

test.describe('appearance preferences', () => {
	test.use({ storageState: storageStatePaths.user1 });

	async function openAppearance(page: import('@playwright/test').Page) {
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await page.getByRole('tab', { name: /Appearance/i }).click();
	}

	test('text size changes the root font size and survives a reload', async ({ page }) => {
		await openAppearance(page);

		const initial = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);

		await page.getByTestId('font-size-select').click();
		await page.getByRole('option', { name: 'Large' }).click();

		await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('18px');
		expect(initial).not.toBe('18px');

		// Persisted in localStorage and applied by the pre-paint script, so there must be no
		// flash-then-resize on reload.
		await page.reload();
		await page.waitForLoadState('networkidle');
		await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('18px');

		// Restore so later tests are unaffected.
		await page.getByRole('tab', { name: /Appearance/i }).click();
		await page.getByTestId('font-size-select').click();
		await page.getByRole('option', { name: 'Default' }).click();
	});

	test('weight unit and currency selectors persist the chosen value', async ({ page }) => {
		await openAppearance(page);

		await page.getByTestId('weight-unit-select').click();
		await page.getByRole('option', { name: 'Pounds' }).click();

		await page.getByTestId('currency-select').click();
		await page.getByRole('option', { name: /EUR/ }).click();

		await expect.poll(() => page.evaluate(() => localStorage.getItem('sharecircle_weight_unit'))).toBe('lbs');
		await expect.poll(() => page.evaluate(() => localStorage.getItem('sharecircle_currency'))).toBe('EUR');

		await page.reload();
		await page.waitForLoadState('networkidle');
		await page.getByRole('tab', { name: /Appearance/i }).click();

		await expect(page.getByTestId('weight-unit-select')).toContainText('Pounds');
		await expect(page.getByTestId('currency-select')).toContainText('EUR');

		// Restore defaults.
		await page.getByTestId('weight-unit-select').click();
		await page.getByRole('option', { name: 'Kilograms' }).click();
		await page.getByTestId('currency-select').click();
		await page.getByRole('option', { name: /USD/ }).click();
	});

	test('currency preference changes how prices render elsewhere', async ({ page }) => {
		await openAppearance(page);
		await page.getByTestId('currency-select').click();
		await page.getByRole('option', { name: /INR/ }).click();

		await page.goto('/home');
		await page.waitForLoadState('networkidle');

		// The dashboard impact panel formats money; with INR selected it must not print a
		// bare dollar sign.
		const moneyMetric = page.getByText(/Money saved/i).first();
		if (await moneyMetric.isVisible({ timeout: 5000 }).catch(() => false)) {
			const panel = page.locator('text=/Money saved/i').locator('xpath=..');
			await expect(panel).not.toContainText('$');
		}

		await page.goto('/settings');
		await page.getByRole('tab', { name: /Appearance/i }).click();
		await page.getByTestId('currency-select').click();
		await page.getByRole('option', { name: /USD/ }).click();
	});
});

test.describe('notification preferences — unified master row', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('shows a single "All notifications" row with both channel toggles', async ({ page }) => {
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await page.getByRole('tab', { name: /Notification/i }).click();

		await expect(page.getByText('All notifications', { exact: true })).toBeVisible();
		await expect(page.getByText('All notifications (in-app)')).toHaveCount(0);
		await expect(page.getByText('All notifications (push)')).toHaveCount(0);

		await expect(page.getByLabel('All in-app notifications')).toBeVisible();
		await expect(page.getByLabel('All push notifications')).toBeVisible();
	});

	test('the two master toggles are independent', async ({ page }) => {
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await page.getByRole('tab', { name: /Notification/i }).click();

		const inApp = page.getByLabel('All in-app notifications');
		const push = page.getByLabel('All push notifications');

		const pushBefore = await push.getAttribute('aria-checked');
		await inApp.click();

		// Sharing one row must not couple the channels.
		await expect(push).toHaveAttribute('aria-checked', pushBefore ?? 'true');

		await inApp.click();
	});
});

// The login and signup Phone tabs are covered in auth-flows.spec.ts, which is where auth-page
// behaviour belongs. Two tests lived here as well, and the login one was flaky: it wrapped its
// assertions in `if (await phoneTab.isVisible(...))`, so it passed vacuously whenever the tab
// query lost a race, and asserted `toBeDisabled()` against a possibly-unhydrated tab otherwise.
// Duplicated coverage that can silently pass is worse than none — removed rather than patched.

test.describe('phone field in settings', () => {
	// Needs a session, unlike the login/signup tabs above.
	test.use({ storageState: storageStatePaths.user1 });

	test('shows the phone field greyed out rather than missing', async ({ page }) => {
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await page.getByRole('tab', { name: /Account/i }).click();

		const row = page.getByTestId('phone-coming-soon');
		await expect(row).toBeVisible();
		await expect(row).toContainText('Coming soon');
		await expect(row.getByRole('textbox')).toBeDisabled();
	});
});
