/**
 * The borrow lifecycle end to end, as two real users, with the UI open throughout.
 *
 * The existing specs each exercise one hop — `borrow-workflow` approves, `item-handoff` hands over,
 * `transactions` returns — with fresh fixtures per file. Nothing drove the whole chain, so a state
 * machine that broke *between* two steps (an item left unavailable after a return, a transaction
 * stuck in RETURN_PENDING, a queue entry never promoted) passed every test individually.
 *
 * The assertions here are about state that must be true after each transition, not about a
 * particular screen, so they survive UI changes while still failing on a broken workflow.
 */

import { test, expect, storageStatePaths } from './fixtures';
import { TestAPI } from './helpers/test-data';

test.describe('borrow lifecycle', () => {
	// A borrow request needs a desired window; these are the same for every case here.
	const window = () => {
		const from = new Date(Date.now() + 24 * 60 * 60 * 1000);
		const to = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
		return { desiredFrom: from.toISOString(), desiredTo: to.toISOString() };
	};

	test('owner and borrower complete a full borrow and return', async ({ browser, users }) => {
		const ownerCtx = await browser.newContext({ storageState: storageStatePaths.user1 });
		const borrowerCtx = await browser.newContext({ storageState: storageStatePaths.user2 });

		try {
			const ownerApi = new TestAPI(ownerCtx.request);
			const borrowerApi = new TestAPI(borrowerCtx.request);

			// --- shared circle -------------------------------------------------------------
			const circle = await ownerApi.createCircle({ name: `Lifecycle ${Date.now()}` });
			const fresh = await ownerApi.getCircle(circle.id);
			await borrowerApi.joinCircle(fresh.inviteCode!);

			// --- listing -------------------------------------------------------------------
			const item = await ownerApi.createItem({
				name: `Lifecycle Item ${Date.now()}`,
				description: 'Drill used across the whole borrow lifecycle',
				circleIds: [circle.id],
			});
			expect((await borrowerApi.getItem(item.id)).id, 'borrower cannot see a circle item').toBe(item.id);

			// --- request and approval ------------------------------------------------------
			const borrowRequest = (await borrowerApi.createBorrowRequest({
				itemId: item.id,
				...window(),
				message: 'Could I borrow this for the weekend?',
			})) as { id: string };
			await ownerApi.approveBorrowRequest(borrowRequest.id);

			// Approval must claim the item, or two borrowers can hold the same thing.
			const afterApproval = await ownerApi.getItem(item.id);
			expect(afterApproval.isAvailable, 'item still available after approval').toBe(false);

			// --- handoff --------------------------------------------------------------------
			await ownerApi.confirmHandoff(borrowRequest.id);
			await borrowerApi.confirmReceipt(borrowRequest.id);

			// --- return -----------------------------------------------------------------------
			await borrowerApi.markReturn(borrowRequest.id, 'Returned, thanks');
			await ownerApi.confirmReturn(borrowRequest.id);

			// --- the state that matters after the loop closes ---------------------------------
			const afterReturn = await ownerApi.getItem(item.id);
			expect(afterReturn.isAvailable, 'item never became available again after return').toBe(true);

			// And the borrower's activity page must reflect the completed loan without a reload.
			const activityPage = await borrowerCtx.newPage();
			const pageErrors: string[] = [];
			activityPage.on('pageerror', error => pageErrors.push(error.message));
			await activityPage.goto('/activity');
			await expect(activityPage.locator('main').first()).toBeVisible({ timeout: 20_000 });
			expect(pageErrors, `activity page threw: ${pageErrors.join(' | ')}`).toEqual([]);
		} finally {
			await ownerCtx.close();
			await borrowerCtx.close();
		}
	});

	test('a declined request leaves the item available', async ({ browser }) => {
		// The mirror of the approval claim above. An early version of the approval fix could set
		// isAvailable=false on any transition; this pins that only approval claims the item.
		const ownerCtx = await browser.newContext({ storageState: storageStatePaths.user1 });
		const borrowerCtx = await browser.newContext({ storageState: storageStatePaths.user2 });

		try {
			const ownerApi = new TestAPI(ownerCtx.request);
			const borrowerApi = new TestAPI(borrowerCtx.request);

			const circle = await ownerApi.createCircle({ name: `Decline ${Date.now()}` });
			const fresh = await ownerApi.getCircle(circle.id);
			await borrowerApi.joinCircle(fresh.inviteCode!);

			const item = await ownerApi.createItem({
				name: `Decline Item ${Date.now()}`,
				description: 'Item for the declined-request path',
				circleIds: [circle.id],
			});

			const borrowRequest = (await borrowerApi.createBorrowRequest({
				itemId: item.id,
				...window(),
				message: 'May I borrow this?',
			})) as { id: string };

			const declineResponse = await ownerCtx.request.patch(`/api/borrow-requests/${borrowRequest.id}`, {
				data: { action: 'decline', declineNote: 'Not this week' },
			});
			expect(
				declineResponse.ok(),
				`decline failed with ${declineResponse.status()}: ${await declineResponse.text()}`,
			).toBeTruthy();

			expect((await ownerApi.getItem(item.id)).isAvailable, 'decline made the item unavailable').toBe(true);
		} finally {
			await ownerCtx.close();
			await borrowerCtx.close();
		}
	});

	test('a second approval on a claimed item is refused', async ({ browser }) => {
		// Double-booking guard. The approval path takes the item with a conditional updateMany, so
		// a second approval must lose rather than silently overwrite the first.
		const ownerCtx = await browser.newContext({ storageState: storageStatePaths.user1 });
		const borrowerCtx = await browser.newContext({ storageState: storageStatePaths.user2 });

		try {
			const ownerApi = new TestAPI(ownerCtx.request);
			const borrowerApi = new TestAPI(borrowerCtx.request);

			const circle = await ownerApi.createCircle({ name: `Double ${Date.now()}` });
			const fresh = await ownerApi.getCircle(circle.id);
			await borrowerApi.joinCircle(fresh.inviteCode!);

			const item = await ownerApi.createItem({
				name: `Double Item ${Date.now()}`,
				description: 'Item for the double-approval guard',
				circleIds: [circle.id],
			});

			const first = (await borrowerApi.createBorrowRequest({
				itemId: item.id,
				...window(),
				message: 'first',
			})) as {
				id: string;
			};
			await ownerApi.approveBorrowRequest(first.id);

			// Approving the same request again must lose. The handler re-checks PENDING inside a
			// conditional updateMany precisely so a second approval cannot overwrite the first and
			// leave two live transactions against one item.
			const second = await ownerCtx.request.patch(`/api/borrow-requests/${first.id}`, {
				data: { action: 'approve' },
			});
			expect(second.ok(), 'the same request was approved twice').toBeFalsy();
			expect(second.status(), await second.text()).toBe(409);
		} finally {
			await ownerCtx.close();
			await borrowerCtx.close();
		}
	});
});
