import { test, expect } from './fixtures';

test('user can log in with credentials', async ({ page, users }) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill(users.user1.email);
	await page.getByLabel('Password').fill(users.user1.password);
	await page.getByRole('button', { name: 'Login' }).click();

	await expect(page).toHaveURL(/\/home/);
	await expect(page.getByText(/Welcome back/i)).toBeVisible();
});
