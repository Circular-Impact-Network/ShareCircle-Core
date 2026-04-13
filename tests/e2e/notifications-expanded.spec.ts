import { test, expect, storageStatePaths } from './fixtures';

test.use({ storageState: storageStatePaths.user1 });

test.describe('Notifications page', () => {
	test('renders all three tabs', async ({ page }) => {
		await page.goto('/notifications');
		await page.waitForLoadState('networkidle');

		await expect(page.getByRole('tab', { name: /Alerts/i })).toBeVisible();
		await expect(page.getByRole('tab', { name: /Borrow Requests/i })).toBeVisible();
		await expect(page.getByRole('tab', { name: /Item Requests/i })).toBeVisible();
	});

	test('switches between tabs via URL', async ({ page }) => {
		await page.goto('/notifications?tab=borrow-requests');
		await page.waitForLoadState('networkidle');

		const borrowTab = page.getByRole('tab', { name: /Borrow Requests/i });
		await expect(borrowTab).toHaveAttribute('data-state', 'active');
	});

	test('mark all as read button exists on alerts tab', async ({ page }) => {
		await page.goto('/notifications?tab=alerts');
		await page.waitForLoadState('networkidle');

		// The "Mark all read" button should be visible (or the page shows empty state)
		const markAllButton = page.getByRole('button', { name: /Mark all read/i });
		const emptyState = page.getByText(/No notifications/i);

		const eitherVisible = await Promise.race([
			markAllButton.waitFor({ state: 'visible', timeout: 3000 }).then(() => 'button'),
			emptyState.waitFor({ state: 'visible', timeout: 3000 }).then(() => 'empty'),
		]).catch(() => 'neither');

		expect(['button', 'empty']).toContain(eitherVisible);
	});

	test('item requests tab shows filter controls', async ({ page }) => {
		await page.goto('/notifications?tab=item-requests');
		await page.waitForLoadState('networkidle');

		// Filter buttons should be visible
		const fromOthers = page.getByRole('button', { name: /From Others/i });
		const myRequests = page.getByRole('button', { name: /My Requests/i });

		await expect(fromOthers).toBeVisible();
		await expect(myRequests).toBeVisible();
	});

	test('can navigate to item requests tab and see create button', async ({ page }) => {
		await page.goto('/notifications?tab=item-requests');
		await page.waitForLoadState('networkidle');

		const createButton = page.getByRole('button', { name: /Create Request/i });
		await expect(createButton).toBeVisible();
	});
});
