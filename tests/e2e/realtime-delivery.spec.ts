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

import type { Page, WebSocketRoute } from '@playwright/test';
import { test, expect, storageStatePaths } from './fixtures';
import { TestAPI } from './helpers/test-data';

/**
 * Collect uncaught exceptions from the page.
 *
 * Asserting on these is not optional here. Every test in this file passed while a `receipt_update`
 * broadcast with the wrong shape was throwing inside a setState updater and unmounting the chat —
 * the message had already rendered by the time it blew up, so the visibility assertion was
 * satisfied and the crash went unreported. A realtime test that does not watch for page errors
 * only proves that the first frame arrived.
 */
function collectPageErrors(page: Page): string[] {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	return errors;
}

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
			const pageErrors = collectPageErrors(page);
			const realtimeErrors: string[] = [];
			page.on('console', msg => {
				// Only console.error counts. A refused first join is logged as a warning and is
				// expected — Supabase declines it while the tenant's database connection warms up,
				// and Phoenix rejoins seconds later. Failing on that would make this test flaky for
				// the one condition that is genuinely fine.
				if (msg.type() !== 'error') return;
				const text = msg.text();
				if (/Realtime auth failed|Realtime token request failed|CHANNEL_ERROR|TIMED_OUT/i.test(text)) {
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
			expect(pageErrors, `uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
		} finally {
			await user1Ctx.close();
			await user2Ctx.close();
		}
	});

	test('the messages list and notification badge update without reloading', async ({ browser, users }) => {
		// Mirrors the reported failure exactly: the recipient is NOT inside the thread. That path
		// uses different hooks from the one covered above — useUserMessages on `user:<id>:messages`
		// and the notifications provider on `notifications:<id>` — so a break there is invisible to
		// a test that only ever sits inside a conversation.
		const user1Ctx = await browser.newContext({ storageState: storageStatePaths.user1 });
		const user2Ctx = await browser.newContext({ storageState: storageStatePaths.user2 });

		try {
			const api1 = new TestAPI(user1Ctx.request);
			const circle = await api1.createCircle({ name: `Realtime List ${Date.now()}` });
			const fresh = await api1.getCircle(circle.id);
			await new TestAPI(user2Ctx.request).joinCircle(fresh.inviteCode!);

			const threadResponse = await user1Ctx.request.post('/api/messages/threads', {
				data: { otherUserId: users.user2.id },
			});
			expect(threadResponse.ok(), `thread creation failed (${threadResponse.status()})`).toBeTruthy();
			const thread = (await threadResponse.json()) as { id: string };

			// Recipient sits on the messages LIST, not in the thread.
			const page = await user1Ctx.newPage();
			const pageErrors = collectPageErrors(page);
			const realtimeErrors: string[] = [];
			page.on('console', msg => {
				// Only console.error counts. A refused first join is logged as a warning and is
				// expected — Supabase declines it while the tenant's database connection warms up,
				// and Phoenix rejoins seconds later. Failing on that would make this test flaky for
				// the one condition that is genuinely fine.
				if (msg.type() !== 'error') return;
				const text = msg.text();
				if (/Realtime auth failed|Realtime token request failed|CHANNEL_ERROR|TIMED_OUT/i.test(text)) {
					realtimeErrors.push(text);
				}
			});

			await page.goto('/messages');
			await page.waitForLoadState('domcontentloaded');
			await page.waitForTimeout(4000);

			const body = `list update probe ${Date.now()}`;
			const sendResponse = await user2Ctx.request.post(`/api/messages/threads/${thread.id}/messages`, {
				data: { body, clientId: `list-${Date.now()}` },
			});
			expect(sendResponse.ok(), `send failed: ${sendResponse.status()}`).toBeTruthy();

			// The list renders the last message body as the thread preview. No reload.
			await expect(page.getByText(body).first()).toBeVisible({ timeout: 20_000 });

			expect(realtimeErrors, `realtime errors: ${realtimeErrors.join(' | ')}`).toEqual([]);
			expect(pageErrors, `uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
		} finally {
			await user1Ctx.close();
			await user2Ctx.close();
		}
	});

	test('messages still arrive after the socket reconnects', async ({ browser, users }) => {
		// The regression that broke messaging in the wild, and which neither test above catches
		// because both only ever exercise a socket's first connect.
		//
		// supabase-js re-authorises inside `RealtimeClient.connect()` using the provider it was
		// constructed with. We used to set our token after the fact via `realtime.setAuth()` and
		// leave that provider at its default, which resolves a GoTrue session — this app has none,
		// so it fell back to the anon key. The first connect usually won the race and everything
		// looked fine; the first *reconnect* (a slept laptop, a dropped wifi, a backgrounded tab)
		// swapped in the anon key, every private channel was refused, and live updates stopped for
		// good. Dropping the network here is the shortest way to reproduce that.
		//
		// Deliberately slow: it waits out a subscribe, a socket drop and a rejoin.
		test.setTimeout(150_000);
		const user1Ctx = await browser.newContext({ storageState: storageStatePaths.user1 });
		const user2Ctx = await browser.newContext({ storageState: storageStatePaths.user2 });

		try {
			const api1 = new TestAPI(user1Ctx.request);
			const circle = await api1.createCircle({ name: `Realtime Reconnect ${Date.now()}` });
			const fresh = await api1.getCircle(circle.id);
			await new TestAPI(user2Ctx.request).joinCircle(fresh.inviteCode!);

			const threadResponse = await user1Ctx.request.post('/api/messages/threads', {
				data: { otherUserId: users.user2.id },
			});
			expect(threadResponse.ok(), `thread creation failed (${threadResponse.status()})`).toBeTruthy();
			const thread = (await threadResponse.json()) as { id: string };

			const page = await user1Ctx.newPage();
			const pageErrors = collectPageErrors(page);

			// Intercepting the socket is the only reliable way to drop it: `context.setOffline`
			// leaves an established WebSocket up, so a test built on it passes against the broken
			// code and proves nothing.
			const sockets: WebSocketRoute[] = [];
			await page.routeWebSocket(/\/realtime\/v1\//, ws => {
				ws.connectToServer();
				sockets.push(ws);
			});

			await page.goto(`/messages/${thread.id}`);
			await page.waitForLoadState('domcontentloaded');
			await page.waitForTimeout(8000);

			const before = `before reconnect ${Date.now()}`;
			await user2Ctx.request.post(`/api/messages/threads/${thread.id}/messages`, {
				data: { body: before, clientId: `pre-${Date.now()}` },
			});
			await expect(page.getByText(before).first()).toBeVisible({ timeout: 20_000 });

			// Drop the transport underneath the client, as a slept laptop or dropped wifi does.
			// The page is never reloaded, so the socket has to re-authorise itself.
			expect(sockets.length, 'no realtime websocket was opened').toBeGreaterThan(0);
			await sockets[sockets.length - 1].close({ code: 4000, reason: 'simulated network drop' });
			await page.waitForTimeout(20_000);

			const after = `after reconnect ${Date.now()}`;
			const sendResponse = await user2Ctx.request.post(`/api/messages/threads/${thread.id}/messages`, {
				data: { body: after, clientId: `post-${Date.now()}` },
			});
			expect(sendResponse.ok(), `send failed: ${sendResponse.status()}`).toBeTruthy();

			await expect(page.getByText(after).first()).toBeVisible({ timeout: 30_000 });
			expect(pageErrors, `uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
		} finally {
			await user1Ctx.close();
			await user2Ctx.close();
		}
	});

	test('both participants keep a working page when read receipts fly back', async ({ browser, users }) => {
		// Two open browsers on the same thread — the reported setup, and the one arrangement none of
		// the tests above create.
		//
		// It matters because receipts travel in the opposite direction to messages. When the
		// recipient's open thread auto-marks the conversation read, the server broadcasts
		// `receipt_update` back to the *sender's* page. Two of the three emitters sent a bare
		// receipt object while the client destructured `payload.receipts`, so the sender's chat
		// threw inside a setState updater and unmounted. A single-page test cannot see that: the
		// message it asserts on has already rendered before the receipt arrives.
		test.setTimeout(120_000);
		const user1Ctx = await browser.newContext({ storageState: storageStatePaths.user1 });
		const user2Ctx = await browser.newContext({ storageState: storageStatePaths.user2 });

		try {
			const api1 = new TestAPI(user1Ctx.request);
			const circle = await api1.createCircle({ name: `Realtime Receipts ${Date.now()}` });
			const fresh = await api1.getCircle(circle.id);
			await new TestAPI(user2Ctx.request).joinCircle(fresh.inviteCode!);

			const threadResponse = await user1Ctx.request.post('/api/messages/threads', {
				data: { otherUserId: users.user2.id },
			});
			expect(threadResponse.ok(), `thread creation failed (${threadResponse.status()})`).toBeTruthy();
			const thread = (await threadResponse.json()) as { id: string };

			// Seed history first. The receipt handler maps over messages already in state, so on an
			// empty thread the faulty payload is never reached and the bug hides — which is exactly
			// why an otherwise correct-looking two-page test still passed against the broken code.
			const seeded = await user2Ctx.request.post(`/api/messages/threads/${thread.id}/messages`, {
				data: { body: `seed history ${Date.now()}`, clientId: `seed-${Date.now()}` },
			});
			expect(seeded.ok(), `seeding failed: ${seeded.status()}`).toBeTruthy();

			const senderPage = await user2Ctx.newPage();
			const senderErrors = collectPageErrors(senderPage);
			const recipientPage = await user1Ctx.newPage();
			const recipientErrors = collectPageErrors(recipientPage);

			await senderPage.goto(`/messages/${thread.id}`);
			await recipientPage.goto(`/messages/${thread.id}`);
			await senderPage.waitForLoadState('domcontentloaded');
			await recipientPage.waitForLoadState('domcontentloaded');
			await recipientPage.waitForTimeout(6000);

			const body = `receipt round trip ${Date.now()}`;
			const sendResponse = await user2Ctx.request.post(`/api/messages/threads/${thread.id}/messages`, {
				data: { body, clientId: `receipt-${Date.now()}` },
			});
			expect(sendResponse.ok(), `send failed: ${sendResponse.status()}`).toBeTruthy();

			// The recipient rendering it is what triggers the read receipt going back.
			await expect(recipientPage.getByText(body).first()).toBeVisible({ timeout: 20_000 });
			await senderPage.waitForTimeout(8000);

			// The sender's page must still be alive after handling the receipt. Its own message is
			// deliberately not asserted here: `useRealtimeChat` skips broadcasts from the current
			// user because the sending page renders them optimistically, and this message was sent
			// through the API rather than that page's composer.
			expect(senderErrors, `sender page crashed: ${senderErrors.join(' | ')}`).toEqual([]);
			expect(recipientErrors, `recipient page crashed: ${recipientErrors.join(' | ')}`).toEqual([]);
			await expect(senderPage.getByPlaceholder('Type a message...')).toBeVisible({ timeout: 10_000 });
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
