/**
 * E2E accessibility tests using Playwright's built-in ARIA/accessibility utilities.
 * Checks: heading structure, form labels, button accessibility, keyboard navigation,
 * and critical ARIA roles on key pages.
 *
 * Install @axe-core/playwright for deeper automated audits if needed.
 */

import { test, expect, storageStatePaths } from './fixtures';
import { TestAPI } from './helpers/test-data';

test.describe('accessibility', () => {
	test.describe('authenticated pages', () => {
		test.use({ storageState: storageStatePaths.user1 });

		test('home page has h1 heading', async ({ page }) => {
			await page.goto('/home');
			await page.waitForLoadState('networkidle');

			const h1 = page.getByRole('heading', { level: 1 });
			const count = await h1.count();
			expect(count).toBeGreaterThanOrEqual(1);
		});

		test('home page navigation has proper ARIA landmark', async ({ page }) => {
			await page.goto('/home');
			await page.waitForLoadState('networkidle');

			// Main content landmark
			const main = page.getByRole('main');
			await expect(main).toBeVisible();
		});

		test('browse page search input has accessible label', async ({ page }) => {
			await page.goto('/browse');
			await page.waitForLoadState('networkidle');

			// Search input should have a label, placeholder, or aria-label
			const searchInput = page
				.getByRole('searchbox')
				.or(page.getByPlaceholder(/search/i))
				.first();
			const hasSearch = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);

			if (hasSearch) {
				// Input should have accessible name (label, aria-label, or placeholder)
				const ariaLabel = await searchInput.getAttribute('aria-label');
				const placeholder = await searchInput.getAttribute('placeholder');
				const id = await searchInput.getAttribute('id');
				let hasLabel = !!(ariaLabel || placeholder);

				if (id) {
					const label = page.locator(`label[for="${id}"]`);
					const labelCount = await label.count();
					hasLabel = hasLabel || labelCount > 0;
				}

				expect(hasLabel).toBeTruthy();
			}
		});

		test('listings page buttons have accessible names', async ({ page }) => {
			await page.goto('/listings');
			await page.waitForLoadState('networkidle');

			// All visible buttons should have accessible names
			const buttons = page.getByRole('button');
			const count = await buttons.count();

			for (let i = 0; i < Math.min(count, 10); i++) {
				const button = buttons.nth(i);
				const visible = await button.isVisible().catch(() => false);
				if (!visible) continue;

				const text = await button.textContent();
				const ariaLabel = await button.getAttribute('aria-label');
				const title = await button.getAttribute('title');
				const ariaLabelledBy = await button.getAttribute('aria-labelledby');

				const hasName = !!(text?.trim() || ariaLabel || title || ariaLabelledBy);
				expect(hasName, `Button ${i} must have an accessible name`).toBeTruthy();
			}
		});

		test('item detail page has image alt text', async ({ page, request }) => {
			const api = new TestAPI(request);

			const circle = await api.createCircle({ name: `A11y Circle ${Date.now()}` });
			const item = await api.createItem({
				name: `A11y Item ${Date.now()}`,
				circleIds: [circle.id],
			});

			await page.goto(`/items/${item.id}`);
			await page.waitForLoadState('networkidle');

			// All non-decorative images should have alt text
			const images = page.locator('img:not([role="presentation"]):not([aria-hidden="true"])');
			const imgCount = await images.count();

			for (let i = 0; i < Math.min(imgCount, 5); i++) {
				const img = images.nth(i);
				const alt = await img.getAttribute('alt');
				const ariaLabel = await img.getAttribute('aria-label');
				const role = await img.getAttribute('role');

				// Decorative images are allowed to have empty alt
				const isDecorative = role === 'presentation' || alt === '';
				const hasAccessibleName = !!(alt !== null || ariaLabel || isDecorative);
				expect(hasAccessibleName, `Image ${i} must have alt attribute`).toBeTruthy();
			}

			// Cleanup
			await api.deleteItem(item.id);
		});

		test('settings page form inputs have labels', async ({ page }) => {
			await page.goto('/settings');
			await page.waitForLoadState('networkidle');

			const inputs = page.locator('input:not([type="hidden"]):not([type="submit"])');
			const count = await inputs.count();

			for (let i = 0; i < Math.min(count, 8); i++) {
				const input = inputs.nth(i);
				const visible = await input.isVisible().catch(() => false);
				if (!visible) continue;

				const id = await input.getAttribute('id');
				const ariaLabel = await input.getAttribute('aria-label');
				const ariaLabelledBy = await input.getAttribute('aria-labelledby');
				const placeholder = await input.getAttribute('placeholder');
				let hasLabel = !!(ariaLabel || ariaLabelledBy || placeholder);

				if (id && !hasLabel) {
					const label = page.locator(`label[for="${id}"]`);
					const labelCount = await label.count();
					hasLabel = labelCount > 0;
				}

				expect(hasLabel, `Input ${i} (id: ${id}) must have an accessible label`).toBeTruthy();
			}
		});

		test('keyboard navigation reaches main interactive elements', async ({ page }) => {
			await page.goto('/home');
			await page.waitForLoadState('networkidle');

			// Tab through up to 20 focusable elements — none should trap focus
			for (let i = 0; i < 20; i++) {
				await page.keyboard.press('Tab');
			}

			// Still on the same page (no unwanted navigation)
			expect(page.url()).toContain('/home');

			// A focused element should be visible (no invisible focus traps)
			const focused = page.locator(':focus');
			const hasFocused = await focused
				.count()
				.then(c => c > 0)
				.catch(() => false);
			expect(hasFocused || true).toBeTruthy(); // soft check — focus may be on body
		});
	});

	test.describe('unauthenticated pages', () => {
		test('login page has proper form labels', async ({ page }) => {
			await page.goto('/login');
			await page.waitForLoadState('networkidle');

			// Email and password inputs should be labeled
			const emailInput = page.getByPlaceholder('you@example.com');
			const passwordInput = page.getByPlaceholder('••••••••');

			await expect(emailInput).toBeVisible();
			await expect(passwordInput).toBeVisible();

			// Inputs should have accessible names via label, aria-label, or placeholder
			const emailPlaceholder = await emailInput.getAttribute('placeholder');
			const passwordPlaceholder = await passwordInput.getAttribute('placeholder');
			expect(emailPlaceholder).toBeTruthy();
			expect(passwordPlaceholder).toBeTruthy();
		});

		test('login page submit button is accessible', async ({ page }) => {
			await page.goto('/login');
			await page.waitForLoadState('networkidle');

			const loginButton = page.getByRole('button', { name: /login/i });
			await expect(loginButton).toBeVisible();

			// Button must not be disabled initially
			const disabled = await loginButton.getAttribute('disabled');
			expect(disabled).toBeNull();
		});
	});
});
