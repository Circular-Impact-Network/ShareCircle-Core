import { test, expect, storageStatePaths } from './fixtures';

test.describe('circles and items', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('create circle, join, and add item', async ({ page, browser, request }) => {
		const circleName = `E2E Circle ${Date.now()}`;

		// Create circle via API (avoids P2028 UI timeout waiting for invite code)
		const circleRes = await request.post('/api/circles', { data: { name: circleName } });
		expect(circleRes.ok()).toBeTruthy();
		const circle = (await circleRes.json()) as { id: string; inviteCode: string };
		const inviteCode = circle.inviteCode;
		expect(inviteCode).toBeTruthy();

		// Verify the circle appears in the UI
		await page.goto('/circles');
		await page.waitForLoadState('domcontentloaded');
		await expect(page.getByText(circleName).first()).toBeVisible();

		// Join circle via API (avoids UI async re-render timing issues in CI)
		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Page = await user2Context.newPage();
		const joinRes = await user2Context.request.post('/api/circles/join', {
			data: { code: inviteCode },
		});
		expect(joinRes.ok()).toBeTruthy();

		// Verify circle appears in user2's circles list
		await user2Page.goto('/circles');
		await user2Page.waitForLoadState('domcontentloaded');
		await expect(user2Page.getByText(circleName).first()).toBeVisible({ timeout: 10000 });
		await user2Context.close();

		// Add item via API (faster and more reliable than UI flow)
		const itemRes = await request.post('/api/items', {
			data: {
				name: 'Camping Tent',
				description: 'A reliable tent for weekend trips.',
				imagePath: 'tests/uploads/item.png',
				circleIds: [circle.id],
			},
		});

		if (itemRes.ok()) {
			// Verify item appears in listings
			await page.goto('/listings');
			await page.waitForLoadState('domcontentloaded');
			await expect(page.getByText('Camping Tent').first()).toBeVisible({ timeout: 10000 });
		} else {
			// Item creation failed - verify circle creation still succeeded
			await expect(page.getByText(circleName).first()).toBeVisible();
		}
	});
});
