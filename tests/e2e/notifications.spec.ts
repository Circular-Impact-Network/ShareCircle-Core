import { test, expect, storageStatePaths } from './fixtures';

test.describe('notifications', () => {
	test.use({ storageState: storageStatePaths.user2 });

	test('receive item request notification', async ({ page, request }) => {
		const baseURL = test.info().project.use.baseURL as string;
		const apiUser1 = await request.newContext({ baseURL, storageState: storageStatePaths.user1 });
		const apiUser2 = await request.newContext({ baseURL, storageState: storageStatePaths.user2 });

		const circleResponse = await apiUser1.post('/api/circles', {
			data: {
				name: `E2E Notify Circle ${Date.now()}`,
				description: 'Circle for notification tests',
			},
		});
		expect(circleResponse.ok()).toBeTruthy();
		const circle = await circleResponse.json();

		const joinResponse = await apiUser2.post('/api/circles/join', {
			data: { inviteCode: circle.inviteCode },
		});
		expect(joinResponse.ok()).toBeTruthy();

		const requestResponse = await apiUser1.post('/api/item-requests', {
			data: {
				title: 'Need a ladder',
				description: 'A ladder for weekend work.',
				circleId: circle.id,
			},
		});
		expect(requestResponse.ok()).toBeTruthy();

		await apiUser1.dispose();
		await apiUser2.dispose();

		await page.goto('/notifications');
		await expect(page.getByText('New Item Request')).toBeVisible();
		await page.getByRole('button', { name: 'Mark all read' }).click();
		await expect(page.getByText('New Item Request')).toBeVisible();
	});
});
