import { test, expect } from './fixtures';

test('user can log in with credentials', async ({ page, users }) => {
	// Call NextAuth credentials endpoint directly to bypass React form hydration issues in CI
	const csrfRes = await page.request.get('/api/auth/csrf');
	const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

	const loginRes = await page.request.post('/api/auth/callback/credentials', {
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		data: new URLSearchParams({
			email: users.user1.email,
			password: users.user1.password,
			csrfToken,
			callbackUrl: 'http://localhost:3003/home',
			json: 'true',
		}).toString(),
	});
	expect(loginRes.ok()).toBeTruthy();
	const loginData = (await loginRes.json()) as { ok: boolean; error?: string; url?: string };
	expect(loginData.error).toBeFalsy();

	await page.goto('/home');
	await page.waitForURL(/\/home/, { timeout: 10000 });
	await expect(page.getByText(/Welcome( back)?/i)).toBeVisible();
});
