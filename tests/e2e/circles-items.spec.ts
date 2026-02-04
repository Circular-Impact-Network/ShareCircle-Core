import { test, expect, storageStatePaths } from './fixtures';

const imageBuffer = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAqMB9Z/4fN0AAAAASUVORK5CYII=',
	'base64',
);

test.describe('circles and items', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('create circle, join, and add item', async ({ page, browser }) => {
		const circleName = `E2E Circle ${Date.now()}`;

		await page.goto('/circles');
		await page.getByRole('button', { name: /Create Circle/i }).click();
		await page.getByLabel('Circle Name').fill(circleName);
		await page.getByRole('button', { name: 'Create Circle' }).click();

		const inviteCode = await page.locator('code').first().textContent();
		expect(inviteCode).toBeTruthy();
		await page.getByRole('button', { name: 'Done' }).click();
		await expect(page.getByText(circleName).first()).toBeVisible();

		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Page = await user2Context.newPage();
		await user2Page.goto('/circles');
		await user2Page.getByRole('button', { name: /Join/i }).click();
		await user2Page.getByLabel('Invite Code').fill(inviteCode!.trim());
		await user2Page.getByRole('button', { name: 'Join Circle' }).click();
		await expect(user2Page.getByText(circleName).first()).toBeVisible();
		await user2Context.close();

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
					items: [{ name: 'Camping Tent' }],
				}),
			});
		});
		await page.route('**/api/items/analyze**', async route => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					name: 'Camping Tent',
					description: 'A reliable tent for weekend trips.',
					categories: ['Outdoors'],
					tags: ['camping'],
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

		await page.getByRole('button', { name: 'Camping Tent' }).click();
		await page.getByPlaceholder('e.g., Camping Tent').fill('Camping Tent');
		await page
			.getByPlaceholder('Describe your item, its condition, and any important details...')
			.fill('A reliable tent for weekend trips.');
		await page.getByRole('button', { name: circleName }).click();
		await page.getByRole('button', { name: 'Create Item' }).click();

		await expect(page.getByText('Camping Tent').first()).toBeVisible();
	});
});
