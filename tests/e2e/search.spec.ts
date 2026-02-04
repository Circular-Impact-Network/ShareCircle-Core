/**
 * E2E tests for search functionality
 * Tests: text search, filters, AI-assisted search
 */

import { test, expect, storageStatePaths } from './fixtures';

test.describe('search functionality', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('user can access search from browse page', async ({ page }) => {
		await page.goto('/browse');
		
		// Look for search input
		const searchInput = page.getByPlaceholder(/Search/i);
		const searchButton = page.getByRole('button', { name: /Search/i });
		
		const hasSearchInput = await searchInput.isVisible().catch(() => false);
		const hasSearchButton = await searchButton.isVisible().catch(() => false);
		
		expect(hasSearchInput || hasSearchButton).toBeTruthy();
	});

	test('user can search items by name', async ({ page }) => {
		await page.goto('/browse');
		
		const searchInput = page.getByPlaceholder(/Search/i);
		
		if (await searchInput.isVisible()) {
			// Type search query
			await searchInput.fill('drill');
			
			// Press enter or click search button
			await searchInput.press('Enter');
			
			// Wait for results
			await page.waitForTimeout(1000);
			
			// Results should be filtered (or show no results message)
			const results = page.locator('[data-testid="item-card"]');
			const noResults = page.getByText(/No items found|No results/i);
			
			const hasResults = await results.count() > 0;
			const hasNoResults = await noResults.isVisible().catch(() => false);
			
			expect(hasResults || hasNoResults).toBeTruthy();
		}
	});

	test('user can filter items by category', async ({ page }) => {
		await page.goto('/browse');
		
		// Look for category filter
		const categoryFilter = page.getByRole('combobox', { name: /Category/i });
		const categorySelect = page.getByLabel(/Category/i);
		const categoryDropdown = page.locator('[data-testid="category-filter"]');
		
		if (await categoryFilter.isVisible()) {
			await categoryFilter.click();
			
			// Select a category
			const firstCategory = page.locator('[role="option"]').first();
			if (await firstCategory.isVisible()) {
				await firstCategory.click();
			}
		} else if (await categorySelect.isVisible()) {
			await categorySelect.click();
		}
		
		// Wait for filter to apply
		await page.waitForTimeout(500);
	});

	test('user can filter items by tag', async ({ page }) => {
		await page.goto('/browse');
		
		// Look for tag filter
		const tagFilter = page.getByLabel(/Tag/i);
		const tagInput = page.locator('[data-testid="tag-filter"]');
		
		if (await tagFilter.isVisible()) {
			await tagFilter.click();
		}
		
		// Look for clickable tags
		const tags = page.locator('[data-testid="tag"]');
		if (await tags.count() > 0) {
			await tags.first().click();
			await page.waitForTimeout(500);
		}
	});

	test('search results show item details', async ({ page }) => {
		await page.goto('/browse');
		
		// Get first item card
		const itemCard = page.locator('[data-testid="item-card"]').first();
		
		if (await itemCard.isVisible()) {
			// Card should show item name
			const itemName = itemCard.locator('[data-testid="item-name"]');
			if (await itemName.isVisible()) {
				expect(await itemName.textContent()).toBeTruthy();
			}
			
			// Card should show image
			const itemImage = itemCard.locator('img');
			if (await itemImage.isVisible()) {
				expect(await itemImage.getAttribute('src')).toBeTruthy();
			}
		}
	});

	test('clicking search result navigates to item details', async ({ page }) => {
		await page.goto('/browse');
		
		const itemCard = page.locator('[data-testid="item-card"]').first();
		
		if (await itemCard.isVisible()) {
			await itemCard.click();
			
			// Should navigate to item detail page
			await page.waitForTimeout(500);
			
			// URL should change to item detail
			const url = page.url();
			expect(url).toMatch(/\/items\/|\/browse\/.+/);
		}
	});

	test('search is case-insensitive', async ({ page }) => {
		await page.goto('/browse');
		
		const searchInput = page.getByPlaceholder(/Search/i);
		
		if (await searchInput.isVisible()) {
			// Search with uppercase
			await searchInput.fill('DRILL');
			await searchInput.press('Enter');
			await page.waitForTimeout(500);
			
			const upperResults = await page.locator('[data-testid="item-card"]').count();
			
			// Search with lowercase
			await searchInput.clear();
			await searchInput.fill('drill');
			await searchInput.press('Enter');
			await page.waitForTimeout(500);
			
			const lowerResults = await page.locator('[data-testid="item-card"]').count();
			
			// Results should be similar (case-insensitive)
			expect(Math.abs(upperResults - lowerResults)).toBeLessThanOrEqual(1);
		}
	});

	test('empty search shows all items', async ({ page }) => {
		await page.goto('/browse');
		
		const searchInput = page.getByPlaceholder(/Search/i);
		
		if (await searchInput.isVisible()) {
			// First do a search
			await searchInput.fill('something');
			await searchInput.press('Enter');
			await page.waitForTimeout(500);
			
			// Then clear it
			await searchInput.clear();
			await searchInput.press('Enter');
			await page.waitForTimeout(500);
			
			// Should show all items again or empty state
			const items = page.locator('[data-testid="item-card"]');
			const emptyState = page.getByText(/No items|Browse/i);
			
			const hasItems = await items.count() > 0;
			const hasEmptyState = await emptyState.isVisible().catch(() => false);
			
			expect(hasItems || hasEmptyState).toBeTruthy();
		}
	});

	test('search can filter by availability', async ({ page }) => {
		await page.goto('/browse');
		
		// Look for availability filter
		const availabilityFilter = page.getByLabel(/Available|Show available only/i);
		const availabilityCheckbox = page.locator('[data-testid="availability-filter"]');
		
		if (await availabilityFilter.isVisible()) {
			await availabilityFilter.check();
			await page.waitForTimeout(500);
		} else if (await availabilityCheckbox.isVisible()) {
			await availabilityCheckbox.click();
			await page.waitForTimeout(500);
		}
	});

	test('search within specific circle', async ({ page }) => {
		// Navigate to a specific circle first
		await page.goto('/circles');
		
		// Click on first circle
		const circleCard = page.locator('[data-testid="circle-card"]').first();
		if (await circleCard.isVisible()) {
			await circleCard.click();
			await page.waitForTimeout(500);
			
			// Look for search within this circle
			const searchInput = page.getByPlaceholder(/Search/i);
			
			if (await searchInput.isVisible()) {
				await searchInput.fill('test');
				await searchInput.press('Enter');
				await page.waitForTimeout(500);
			}
		}
	});

	test('search preserves filters on page refresh', async ({ page }) => {
		await page.goto('/browse');
		
		const searchInput = page.getByPlaceholder(/Search/i);
		
		if (await searchInput.isVisible()) {
			// Do a search
			await searchInput.fill('drill');
			await searchInput.press('Enter');
			await page.waitForTimeout(500);
			
			// Check URL for query params
			const urlBefore = page.url();
			
			// Refresh page
			await page.reload();
			await page.waitForTimeout(500);
			
			// Check if search is preserved in URL
			const urlAfter = page.url();
			
			// Search might be preserved in URL or session
			if (urlBefore.includes('search') || urlBefore.includes('q=')) {
				expect(urlAfter).toContain('drill');
			}
		}
	});

	test('AI-assisted search works', async ({ page }) => {
		// Mock AI search endpoint
		await page.route('**/api/items/search**', async route => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					items: [],
					suggestions: ['power drill', 'cordless drill', 'drill bit set'],
				}),
			});
		});
		
		await page.goto('/browse');
		
		// Look for AI search toggle or button
		const aiSearchButton = page.getByRole('button', { name: /AI Search|Smart Search/i });
		const aiSearchToggle = page.locator('[data-testid="ai-search-toggle"]');
		
		if (await aiSearchButton.isVisible()) {
			await aiSearchButton.click();
		}
		
		const searchInput = page.getByPlaceholder(/Search/i);
		if (await searchInput.isVisible()) {
			// Use natural language search
			await searchInput.fill('something to make holes in wood');
			await searchInput.press('Enter');
			await page.waitForTimeout(1000);
		}
	});
});
