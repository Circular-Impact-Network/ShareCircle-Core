import { test, expect, storageStatePaths } from './fixtures';

test.describe('messages', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('send a message in a direct thread', async ({ page, request, users }) => {
		const baseURL = test.info().project.use.baseURL as string;
		const api = await request.newContext({ baseURL, storageState: storageStatePaths.user1 });

		const response = await api.post('/api/messages/threads', {
			data: { otherUserId: users.user2.id },
		});
		expect(response.ok()).toBeTruthy();

		await api.dispose();

		await page.goto('/messages');
		await page.getByText(users.user2.name).click();
		await page.getByPlaceholder('Type a message...').fill('Hello from user1');
		await page.getByRole('button', { name: 'Send' }).click();

		await expect(page.getByText('Hello from user1')).toBeVisible();
	});
});
