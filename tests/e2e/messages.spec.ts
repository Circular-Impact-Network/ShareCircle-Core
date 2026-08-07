import { test, expect, storageStatePaths } from './fixtures';
import { TestAPI } from './helpers/test-data';

test.describe('messages', () => {
	test.use({ storageState: storageStatePaths.user1 });

	/**
	 * Sends a message through the composer, in a browser, and asserts it renders.
	 *
	 * What this replaced was not a working test. It created the thread over the API and then never
	 * navigated — the only `goto` lived inside an `if (!response.ok())` bail-out. In practice the
	 * API *did* fail, with `403 You can only chat with users who share a circle`, because the two
	 * fixture users share no circle by default; the bail-out swallowed that, went to `/messages`,
	 * found no composer on a page it had loaded for other reasons, and finished on an assertion the
	 * fallback happened to satisfy. So the suite reported a passing "send a message" test that had
	 * never sent a message.
	 */
	test('send a message in a direct thread', async ({ page, request, users, browser }) => {
		// A direct thread requires a shared circle — that is the precondition the old test was
		// missing, not an incidental detail.
		const api = new TestAPI(request);
		const circle = await api.createCircle({ name: `Direct Message Circle ${Date.now()}` });
		const fresh = await api.getCircle(circle.id);

		const user2Ctx = await browser.newContext({ storageState: storageStatePaths.user2 });
		try {
			await new TestAPI(user2Ctx.request).joinCircle(fresh.inviteCode!);

			const response = await request.post('/api/messages/threads', {
				data: { otherUserId: users.user2.id },
			});
			expect(
				response.ok(),
				`thread creation failed with ${response.status()}: ${await response.text()}`,
			).toBeTruthy();
			const thread = (await response.json()) as { id: string };

			await page.goto(`/messages/${thread.id}`);
			await page.waitForLoadState('domcontentloaded');

			const body = `Hello from user1 ${Date.now()}`;
			await page.getByPlaceholder('Type a message...').fill(body);
			await page.getByRole('button', { name: /Send/i }).click();

			await expect(page.getByText(body)).toBeVisible({ timeout: 20_000 });
		} finally {
			await user2Ctx.close();
		}
	});
});
