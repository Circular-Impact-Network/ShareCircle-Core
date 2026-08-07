/**
 * E2E tests for the greyed-out "coming soon" signposts and the mobile-only install prompt.
 */

import { test, expect, storageStatePaths } from './fixtures';
import { TestAPI } from './helpers/test-data';

test.describe('security deposit signpost on the item page', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('shows a display-only Security deposit row that cannot be interacted with', async ({ page, request }) => {
		const api = new TestAPI(request);
		const circle = await api.createCircle({ name: `Deposit Circle ${Date.now()}` });
		const item = await api.createItem({ name: `DepositItem ${Date.now()}`, circleIds: [circle.id] });

		await page.goto(`/items/${item.id}`);
		await page.waitForLoadState('networkidle');

		const row = page.getByTestId('security-deposit-row');
		await expect(row).toBeVisible();
		await expect(row).toContainText('Security deposit');
		await expect(row).toContainText('Not set yet');
		await expect(row).toContainText('Coming soon');

		// Display-only: no form control or link, and marked disabled for assistive tech.
		await expect(row).toHaveAttribute('aria-disabled', 'true');
		await expect(row.locator('input, button, a, select')).toHaveCount(0);
	});

	/**
	 * Requirement (2026-08-05): "Add greyed-out 'Security deposit' field to the Create / Edit Item
	 * Listing form". The row was originally built on the detail view only — this asserts the
	 * surface the request actually named.
	 */
	test('shows the same display-only row on the Edit Item form', async ({ page, request }) => {
		const api = new TestAPI(request);
		const circle = await api.createCircle({ name: `Deposit Edit Circle ${Date.now()}` });
		const item = await api.createItem({ name: `DepositEditItem ${Date.now()}`, circleIds: [circle.id] });

		await page.goto(`/items/${item.id}`);
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: /^Edit/i }).first().click();

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		const row = dialog.getByTestId('security-deposit-row');
		await expect(row).toBeVisible();
		await expect(row).toContainText('Security deposit');
		await expect(row).toContainText('Not set yet');
		await expect(row).toContainText('Coming soon');
		await expect(row).toHaveAttribute('aria-disabled', 'true');
		// Must not be a form element — it sits beside real inputs, so this is the distinction
		// that matters most here.
		await expect(row.locator('input, button, a, select')).toHaveCount(0);
	});
});

test.describe('raise a concern signpost on activity cards', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('renders a disabled Raise a concern button with a Coming soon pill', async ({ page }) => {
		await page.goto('/activity');
		await page.waitForLoadState('networkidle');

		const buttons = page.getByTestId('raise-concern-btn');
		if ((await buttons.count()) === 0) {
			test.skip(true, 'No active borrow/lend transactions for this user');
			return;
		}

		const first = buttons.first();
		await expect(first).toBeVisible();
		await expect(first).toBeDisabled();
		await expect(first).toContainText('Coming soon');
	});
});

/**
 * Install prompts are phone-only. Asserting the *rule* rather than hardcoding an expectation
 * lets the same test run under both the Desktop and Mobile Playwright projects.
 */
test.describe('PWA install prompt is mobile-only', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('install UI appears only on touch devices without hover', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');

		const isDesktop = await page.evaluate(() => window.matchMedia('(pointer: fine) and (hover: hover)').matches);

		const banner = page.getByText(/Install ShareCircle|Install on iPhone/);

		if (isDesktop) {
			// The reported problem: desktop users were being offered a phone install.
			await expect(banner).toHaveCount(0);
		} else {
			// May legitimately be absent (already installed, or dismissed this tab-session),
			// so only assert that nothing desktop-only leaked in.
			await expect(page.getByText('Install on this device')).toHaveCount(0);
		}
	});

	test('settings offers an Install button only on mobile', async ({ page }) => {
		await page.goto('/settings');
		await page.waitForLoadState('networkidle');
		await page.getByRole('tab', { name: /About/i }).click();

		const isDesktop = await page.evaluate(() => window.matchMedia('(pointer: fine) and (hover: hover)').matches);

		if (isDesktop) {
			// usePWAInstall reports 'unsupported' on desktop, so the row renders no CTA.
			await expect(page.getByRole('button', { name: /^Install$/ })).toHaveCount(0);
		}
	});
});
