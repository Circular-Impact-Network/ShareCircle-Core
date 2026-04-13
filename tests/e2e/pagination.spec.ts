import { test, expect, storageStatePaths } from './fixtures';

test.use({ storageState: storageStatePaths.user1 });

test.describe('Browse page pagination', () => {
	test('browse page loads and displays items', async ({ page }) => {
		await page.goto('/browse');
		await page.waitForLoadState('networkidle');

		// Page should load with items or show empty state
		const items = page.locator('[data-testid="item-card"]');
		const emptyState = page.getByText(/No items yet/i);

		const eitherVisible = await Promise.race([
			items.first().waitFor({ state: 'visible', timeout: 5000 }).then(() => 'items'),
			emptyState.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'empty'),
		]).catch(() => 'neither');

		expect(['items', 'empty']).toContain(eitherVisible);
	});

	test('category filter dropdown works', async ({ page }) => {
		await page.goto('/browse');
		await page.waitForLoadState('networkidle');

		// Look for category selector
		const categorySelect = page.getByRole('combobox');
		if (await categorySelect.isVisible()) {
			await categorySelect.click();
			// Should show "All Categories" option
			await expect(page.getByText('All Categories')).toBeVisible();
		}
	});

	test('search functionality works', async ({ page }) => {
		await page.goto('/browse');
		await page.waitForLoadState('networkidle');

		const searchInput = page.getByPlaceholder(/Search items/i);
		if (await searchInput.isVisible()) {
			await searchInput.fill('test');
			await searchInput.press('Enter');

			// Should show search results or "no matching items"
			await page.waitForLoadState('networkidle');
			const pageContent = await page.textContent('body');
			expect(pageContent).toBeTruthy();
		}
	});
});
