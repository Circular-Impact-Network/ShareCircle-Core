import { test, expect, storageStatePaths } from './fixtures';

test.use({ storageState: storageStatePaths.user1 });

test.describe('Dashboard', () => {
	test('renders welcome message and all dashboard sections', async ({ page, users }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');

		// Welcome banner
		await expect(page.getByText(/Welcome/i)).toBeVisible();

		// Core sections exist
		await expect(page.getByText('Borrow requests')).toBeVisible();
		await expect(page.getByText('Notifications')).toBeVisible();
		await expect(page.getByText('Messages')).toBeVisible();
		await expect(page.getByText('Requested Items')).toBeVisible();
		await expect(page.getByText('My circles')).toBeVisible();
	});

	test('search form navigates to browse page', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');

		const searchInput = page.getByPlaceholder(/Search for items/i);
		await searchInput.fill('test item');
		await searchInput.press('Enter');

		await expect(page).toHaveURL(/\/browse\?q=test\+item/);
	});

	test('quick action buttons navigate correctly', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');

		// "Browse items" button
		const browseButton = page.getByRole('link', { name: /Browse items/i });
		await expect(browseButton).toBeVisible();
		await expect(browseButton).toHaveAttribute('href', '/browse');
	});

	test('section links navigate to detail pages', async ({ page }) => {
		await page.goto('/home');
		await page.waitForLoadState('networkidle');

		// "View all requests" link
		const requestsLink = page.getByRole('link', { name: /View all requests/i });
		await expect(requestsLink).toBeVisible();

		// "View all notifications" link
		const notificationsLink = page.getByRole('link', { name: /View all notifications/i });
		await expect(notificationsLink).toBeVisible();

		// "View all messages" link
		const messagesLink = page.getByRole('link', { name: /View all messages/i });
		await expect(messagesLink).toBeVisible();
	});
});
