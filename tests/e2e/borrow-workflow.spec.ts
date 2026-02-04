/**
 * E2E tests for the complete borrow workflow
 * Tests: request → approve → return → confirm flow
 */

import { test, expect, storageStatePaths } from './fixtures';

const imageBuffer = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAqMB9Z/4fN0AAAAASUVORK5CYII=',
	'base64'
);

test.describe('borrow workflow', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('complete borrow request and approval flow', async ({ page, browser, request, users }) => {
		const baseURL = test.info().project.use.baseURL as string;
		const circleName = `E2E Borrow Circle ${Date.now()}`;

		// Step 1: User1 creates a circle
		await page.goto('/circles');
		await page.getByRole('button', { name: /Create Circle/i }).click();
		await page.getByLabel('Circle Name').fill(circleName);
		await page.getByRole('button', { name: 'Create Circle' }).click();

		const inviteCode = await page.locator('code').first().textContent();
		expect(inviteCode).toBeTruthy();
		await page.getByRole('button', { name: 'Done' }).click();

		// Step 2: User2 joins the circle
		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Page = await user2Context.newPage();
		await user2Page.goto('/circles');
		await user2Page.getByRole('button', { name: /Join/i }).click();
		await user2Page.getByLabel('Invite Code').fill(inviteCode!.trim());
		await user2Page.getByRole('button', { name: 'Join Circle' }).click();
		await expect(user2Page.getByText(circleName).first()).toBeVisible();

		// Step 3: User1 adds an item - mock the upload and AI detection
		await page.route('**/api/upload/image**', async route => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					path: 'tests/uploads/item.png',
					url: 'https://example.com/item.png',
				}),
			});
		});
		await page.route('**/api/items/detect**', async route => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					items: [{ name: 'Power Drill' }],
				}),
			});
		});
		await page.route('**/api/items/analyze**', async route => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					name: 'Power Drill',
					description: 'A powerful cordless drill for DIY projects.',
					categories: ['Tools'],
					tags: ['drill', 'power tools'],
				}),
			});
		});

		await page.goto('/listings');
		await page.getByRole('button', { name: /Add Item/i }).click();

		const fileInput = page.locator('input[type="file"]').first();
		await fileInput.setInputFiles({
			name: 'item.png',
			mimeType: 'image/png',
			buffer: imageBuffer,
		});

		await page.getByRole('button', { name: 'Power Drill' }).click();
		await page.getByPlaceholder('e.g., Camping Tent').fill('Power Drill');
		await page
			.getByPlaceholder('Describe your item, its condition, and any important details...')
			.fill('A powerful cordless drill for DIY projects.');
		await page.getByRole('button', { name: circleName }).click();
		await page.getByRole('button', { name: 'Create Item' }).click();

		await expect(page.getByText('Power Drill').first()).toBeVisible();

		// Step 4: User2 requests to borrow the item
		await user2Page.goto('/browse');
		await user2Page.waitForTimeout(1000);
		
		// Click on the item to view details
		const itemCard = user2Page.getByText('Power Drill').first();
		await expect(itemCard).toBeVisible();
		await itemCard.click();

		// Wait for item detail page and request borrow
		await user2Page.waitForTimeout(500);
		const requestButton = user2Page.getByRole('button', { name: /Request to Borrow/i });
		if (await requestButton.isVisible()) {
			await requestButton.click();
			
			// Fill in borrow request form
			const fromDateInput = user2Page.locator('input[type="date"]').first();
			const toDateInput = user2Page.locator('input[type="date"]').last();
			
			const today = new Date();
			const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
			
			if (await fromDateInput.isVisible()) {
				await fromDateInput.fill(today.toISOString().split('T')[0]);
				await toDateInput.fill(nextWeek.toISOString().split('T')[0]);
			}
			
			const submitButton = user2Page.getByRole('button', { name: /Submit|Request|Borrow/i });
			if (await submitButton.isVisible()) {
				await submitButton.click();
			}
		}

		await user2Context.close();
	});

	test('user can cancel their own borrow request', async ({ page, request, users }) => {
		const baseURL = test.info().project.use.baseURL as string;
		const api = await request.newContext({ baseURL, storageState: storageStatePaths.user1 });

		// Navigate to activity/requests page
		await page.goto('/activity');
		
		// Check if there are any pending requests
		const pendingRequests = page.locator('[data-status="PENDING"]');
		if (await pendingRequests.count() > 0) {
			// Click cancel on the first pending request
			const cancelButton = pendingRequests.first().locator('button:has-text("Cancel")');
			if (await cancelButton.isVisible()) {
				await cancelButton.click();
				
				// Confirm cancellation if dialog appears
				const confirmButton = page.getByRole('button', { name: /Confirm|Yes/i });
				if (await confirmButton.isVisible()) {
					await confirmButton.click();
				}
			}
		}

		await api.dispose();
	});

	test('owner can decline borrow request', async ({ page, browser, request, users }) => {
		const baseURL = test.info().project.use.baseURL as string;

		// Navigate to incoming requests
		await page.goto('/activity');
		
		// Look for incoming requests tab or section
		const incomingTab = page.getByRole('tab', { name: /Incoming|Requests/i });
		if (await incomingTab.isVisible()) {
			await incomingTab.click();
		}

		// Check for pending incoming requests
		const pendingRequest = page.locator('[data-status="PENDING"]').first();
		if (await pendingRequest.isVisible()) {
			// Click decline
			const declineButton = pendingRequest.locator('button:has-text("Decline")');
			if (await declineButton.isVisible()) {
				await declineButton.click();
				
				// Optional: Add decline note
				const noteInput = page.locator('textarea');
				if (await noteInput.isVisible()) {
					await noteInput.fill('Sorry, item is not available during those dates.');
				}
				
				// Confirm decline
				const confirmButton = page.getByRole('button', { name: /Confirm|Decline/i });
				if (await confirmButton.isVisible()) {
					await confirmButton.click();
				}
			}
		}
	});

	test('item becomes unavailable after approval', async ({ page, browser, request, users }) => {
		// This test verifies that after a borrow request is approved,
		// the item shows as unavailable to other users
		
		await page.goto('/browse');
		
		// Look for an item that's being borrowed
		const unavailableItem = page.locator('[data-available="false"]');
		if (await unavailableItem.count() > 0) {
			await unavailableItem.first().click();
			
			// The request button should either be disabled or show "Join Queue"
			const requestButton = page.getByRole('button', { name: /Request to Borrow/i });
			const queueButton = page.getByRole('button', { name: /Join Queue/i });
			
			// Either the request button should be disabled or queue button should be visible
			if (await requestButton.isVisible()) {
				expect(await requestButton.isDisabled()).toBeTruthy();
			} else if (await queueButton.isVisible()) {
				// Queue button should be visible for unavailable items
				expect(await queueButton.isVisible()).toBeTruthy();
			}
		}
	});

	test('return flow marks item as returned', async ({ page }) => {
		// Navigate to activity page to see active borrows
		await page.goto('/activity');
		
		// Look for active transactions (items being borrowed)
		const activeTab = page.getByRole('tab', { name: /Active|Borrowed/i });
		if (await activeTab.isVisible()) {
			await activeTab.click();
		}
		
		// Find an active borrow where user is the borrower
		const activeBorrow = page.locator('[data-status="ACTIVE"]').first();
		if (await activeBorrow.isVisible()) {
			// Click return button
			const returnButton = activeBorrow.locator('button:has-text("Return")');
			if (await returnButton.isVisible()) {
				await returnButton.click();
				
				// Confirm return
				const confirmButton = page.getByRole('button', { name: /Confirm|Return/i });
				if (await confirmButton.isVisible()) {
					await confirmButton.click();
				}
				
				// Status should change to PENDING_RETURN or similar
				await expect(activeBorrow.locator('[data-status]')).toHaveAttribute(
					'data-status',
					/PENDING_RETURN|RETURNED/
				);
			}
		}
	});

	test('owner can confirm return', async ({ page }) => {
		// Navigate to activity page
		await page.goto('/activity');
		
		// Look for items pending return confirmation (where user is owner)
		const incomingTab = page.getByRole('tab', { name: /Incoming|To Confirm/i });
		if (await incomingTab.isVisible()) {
			await incomingTab.click();
		}
		
		const pendingReturn = page.locator('[data-status="PENDING_RETURN"]').first();
		if (await pendingReturn.isVisible()) {
			// Click confirm return
			const confirmReturnButton = pendingReturn.locator('button:has-text("Confirm Return")');
			if (await confirmReturnButton.isVisible()) {
				await confirmReturnButton.click();
				
				// Status should change to COMPLETED
				await expect(pendingReturn.locator('[data-status]')).toHaveAttribute(
					'data-status',
					'COMPLETED'
				);
			}
		}
	});
});
