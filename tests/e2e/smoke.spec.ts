import { test, expect } from '@playwright/test';

// Minimal smoke tests for production — read-only, no data mutations
test.describe('smoke', () => {
	test('root redirects to login when signed out', async ({ page }) => {
		// Marketing moved to circularimpact.org/sharecircle; the app root only routes.
		await page.goto('/');
		await expect(page).toHaveURL(/\/login/);
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
