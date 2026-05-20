import { test, expect } from '@playwright/test';

// Minimal smoke tests for production — read-only, no data mutations
test.describe('smoke', () => {
	test('landing page loads', async ({ page }) => {
		await page.goto('/landing');
		await expect(page).toHaveTitle(/ShareCircle/i);
	});

	test('login page loads', async ({ page }) => {
		await page.goto('/login');
		await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
	});

	test('health: API responds', async ({ request }) => {
		const res = await request.get('/api/auth/providers');
		expect(res.status()).toBeLessThan(500);
	});
});
