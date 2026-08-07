/**
 * Live realtime delivery into an already-open UI.
 *
 * This file exists because nothing covered it. `messaging-features.spec.ts` drives the message
 * APIs but contains no `goto`/`reload` at all — it never has a page open — and its two UI realtime
 * cases (C21 typing, C22 presence) are permanently skipped for want of test ids. So the entire
 * question "does a message appear without reloading?" was untested, and a change that broke
 * realtime could pass the whole suite.
 *
 * Every assertion here is deliberately made against a page that is already open and never
 * refreshed. If these pass only after a reload, they are worthless.
 */

import { test, expect, storageStatePaths } from './fixtures';
import { TestAPI } from './helpers/test-data';

test.describe('realtime delivery into an open page', () => {
	test('a message from another user appears without reloading', async ({ browser, users }) => {
		const user1Ctx = await browser.newContext({ storageState: storageStatePaths.user1 });
		const user2Ctx = await browser.newContext({ storageState: storageStatePaths.user2 });

		try {
			// A direct thread requires a shared circle. Established here rather than skipped on
			// failure, because a skipped test is exactly how this area went uncovered.
			const api1 = new TestAPI(user1Ctx.request);
			const circle = await api1.createCircle({ name: `Realtime Delivery ${Date.now()}` });
			const fresh = await api1.getCircle(circle.id);
			await new TestAPI(user2Ctx.request).joinCircle(fresh.inviteCode!);

			const threadResponse = await user1Ctx.request.post('/api/messages/threads', {
				data: { otherUserId: users.user2.id },
			});
			expect(
				threadResponse.ok(),
				`thread creation failed (${threadResponse.status()}) — user1 and user2 must share a circle`,
			).toBeTruthy();
			const thread = (await threadResponse.json()) as { id: string };

			// user1 opens the thread and leaves it open for the rest of the test.
			const page = await user1Ctx.newPage();
			const realtimeErrors: string[] = [];
			page.on('console', msg => {
				const text = msg.text();
				if (/Realtime auth failed|Realtime token request failed|CHANNEL_ERROR/i.test(text)) {
					realtimeErrors.push(text);
				}
			});

			await page.goto(`/messages/${thread.id}`);
			await page.waitForLoadState('domcontentloaded');

			// Give the socket time to authorise and join before anything is sent, so a failure here
			// is a delivery failure rather than a race with subscription.
			await page.waitForTimeout(4000);

			const body = `live delivery probe ${Date.now()}`;
			const sendResponse = await user2Ctx.request.post(`/api/messages/threads/${thread.id}/messages`, {
				data: { body, clientId: `live-${Date.now()}` },
			});
			expect(sendResponse.ok(), `send failed: ${sendResponse.status()}`).toBeTruthy();

			// No reload, no navigation. Either the broadcast lands or realtime is broken.
			await expect(page.getByText(body).first()).toBeVisible({ timeout: 20_000 });

			expect(realtimeErrors, `realtime errors in console: ${realtimeErrors.join(' | ')}`).toEqual([]);
		} finally {
			await user1Ctx.close();
			await user2Ctx.close();
		}
	});

	test('the realtime token endpoint issues a usable token', async ({ browser }) => {
		const ctx = await browser.newContext({ storageState: storageStatePaths.user1 });
		try {
			const res = await ctx.request.get('/api/realtime/token');
			expect(res.ok(), `token endpoint returned ${res.status()}`).toBeTruthy();

			const { token, expiresAt } = (await res.json()) as { token: string; expiresAt: number };
			expect(token.split('.')).toHaveLength(3); // header.payload.signature
			expect(expiresAt).toBeGreaterThan(Date.now());

			// The claim the RLS policies read. Our ids are cuids, so it cannot live in `sub` —
			// auth.uid() would try to cast it to a uuid and raise on every check.
			const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as {
				role?: string;
				app_user_id?: string;
			};
			expect(claims.role).toBe('authenticated');
			expect(claims.app_user_id).toBeTruthy();
		} finally {
			await ctx.close();
		}
	});
});
