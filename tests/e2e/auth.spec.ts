import { test, expect } from './fixtures';

test('user can log in with credentials', async ({ page, users }) => {
	await page.goto('/login');
	await page.getByPlaceholder('you@example.com').fill(users.user1.email);
	await page.getByPlaceholder('••••••••').fill(users.user1.password);
	await page.getByRole('button', { name: 'Login', exact: true }).click();

	await expect(page).toHaveURL(/\/home/);
	await expect(page.getByText(/Welcome back/i)).toBeVisible();
});
