/**
 * E2E tests for item handoff flows and deletion with active borrows.
 * Tests the full borrow state machine: ACTIVE → handoff → return → completion.
 * All tests are API-level (no UI navigation needed).
 */

import { test, expect, storageStatePaths } from './fixtures';
import { TestAPI, dateHelpers } from './helpers/test-data';

// ─── Item Deletion With Borrows ───────────────────────────────────────────────

test.describe('item deletion with active borrows', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('cannot delete item with an active borrow transaction', async ({ request, browser }) => {
		const user1Api = new TestAPI(request);

		// User1 creates circle and item
		const circle = await user1Api.createCircle({ name: `Deletion Borrow Circle ${Date.now()}` });
		const item = await user1Api.createItem({ name: `Active Borrow Item ${Date.now()}`, circleIds: [circle.id] });

		// User2 joins the circle and creates a borrow request
		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Request = user2Context.request;
		const user2Api = new TestAPI(user2Request);
		await user2Api.joinCircle(circle.inviteCode);
		const borrowRequest = await user2Api.createBorrowRequest({
			itemId: item.id,
			desiredFrom: dateHelpers.tomorrow(),
			desiredTo: dateHelpers.nextWeek(),
		});

		// User1 approves — creates an ACTIVE transaction
		await user1Api.approveBorrowRequest(borrowRequest.id);

		// User1 tries to delete the item — should be blocked
		const deleteResponse = await request.delete(`/api/items/${item.id}`);
		expect(deleteResponse.status()).toBe(409);
		const body = (await deleteResponse.json()) as { error: string };
		expect(body.error).toMatch(/active borrow transactions/i);

		// Item still exists
		const getResponse = await request.get(`/api/items/${item.id}`);
		expect(getResponse.status()).toBe(200);

		await user2Context.close();
	});

	test('can delete item after all borrow transactions are completed', async ({ request, browser }) => {
		const user1Api = new TestAPI(request);

		const circle = await user1Api.createCircle({ name: `Completed Borrow Circle ${Date.now()}` });
		const item = await user1Api.createItem({
			name: `Completed Borrow Item ${Date.now()}`,
			circleIds: [circle.id],
		});

		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Request = user2Context.request;
		const user2Api = new TestAPI(user2Request);
		await user2Api.joinCircle(circle.inviteCode);
		const borrowRequest = await user2Api.createBorrowRequest({
			itemId: item.id,
			desiredFrom: dateHelpers.tomorrow(),
			desiredTo: dateHelpers.nextWeek(),
		});

		// Run the full cycle: approve → return → confirm
		await user1Api.approveBorrowRequest(borrowRequest.id);
		await user2Api.markReturn(borrowRequest.id);
		await user1Api.confirmReturn(borrowRequest.id);

		// Now delete should succeed
		const deleteResponse = await request.delete(`/api/items/${item.id}`);
		expect(deleteResponse.status()).toBe(200);

		// Item should be gone
		const getResponse = await request.get(`/api/items/${item.id}`);
		expect(getResponse.status()).toBe(404);

		await user2Context.close();
	});

	test('can delete item when borrow request was only cancelled (no transaction)', async ({
		request,
		browser,
	}) => {
		const user1Api = new TestAPI(request);

		const circle = await user1Api.createCircle({ name: `Cancelled Borrow Circle ${Date.now()}` });
		const item = await user1Api.createItem({
			name: `Cancelled Borrow Item ${Date.now()}`,
			circleIds: [circle.id],
		});

		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Request = user2Context.request;
		const user2Api = new TestAPI(user2Request);
		await user2Api.joinCircle(circle.inviteCode);
		const borrowRequest = await user2Api.createBorrowRequest({
			itemId: item.id,
			desiredFrom: dateHelpers.tomorrow(),
			desiredTo: dateHelpers.nextWeek(),
		});

		// Borrower cancels before approval — no transaction created
		await user2Api.cancelBorrowRequest(borrowRequest.id);

		// Delete should succeed since there's no active transaction
		const deleteResponse = await request.delete(`/api/items/${item.id}`);
		expect(deleteResponse.status()).toBe(200);

		await user2Context.close();
	});
});

// ─── Full Handoff Cycle ───────────────────────────────────────────────────────

test.describe('full handoff cycle (ACTIVE → LENDER_CONFIRMED → BORROWER_CONFIRMED → RETURN_PENDING → COMPLETED)', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('completes the full formal handoff flow', async ({ request, browser }) => {
		const user1Api = new TestAPI(request);

		const circle = await user1Api.createCircle({ name: `Full Handoff Circle ${Date.now()}` });
		const item = await user1Api.createItem({ name: `Handoff Item ${Date.now()}`, circleIds: [circle.id] });

		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Request = user2Context.request;
		const user2Api = new TestAPI(user2Request);
		await user2Api.joinCircle(circle.inviteCode);
		const borrowRequest = await user2Api.createBorrowRequest({
			itemId: item.id,
			desiredFrom: dateHelpers.tomorrow(),
			desiredTo: dateHelpers.nextWeek(),
		});

		// Approve → ACTIVE
		const approved = (await user1Api.approveBorrowRequest(borrowRequest.id)) as { transaction: { status: string } };
		expect(approved.transaction.status).toBe('ACTIVE');

		// Lender confirms handoff → LENDER_CONFIRMED
		const handoff = (await user1Api.confirmHandoff(borrowRequest.id)) as { transaction: { status: string } };
		expect(handoff.transaction.status).toBe('LENDER_CONFIRMED');

		// Borrower confirms receipt → BORROWER_CONFIRMED
		const receipt = (await user2Api.confirmReceipt(borrowRequest.id)) as { transaction: { status: string } };
		expect(receipt.transaction.status).toBe('BORROWER_CONFIRMED');

		// Borrower marks return → RETURN_PENDING
		const returned = (await user2Api.markReturn(borrowRequest.id, 'Returned in good condition')) as {
			transaction: { status: string };
		};
		expect(returned.transaction.status).toBe('RETURN_PENDING');

		// Lender confirms return → COMPLETED
		const confirmed = (await user1Api.confirmReturn(borrowRequest.id)) as { transaction: { status: string } };
		expect(confirmed.transaction.status).toBe('COMPLETED');

		// Item should be available again
		const itemAfter = (await request.get(`/api/items/${item.id}`).then(r => r.json())) as { isAvailable: boolean };
		expect(itemAfter.isAvailable).toBe(true);

		await user2Context.close();
	});
});

// ─── Informal Handoff Shortcut ────────────────────────────────────────────────

test.describe('informal handoff shortcut (ACTIVE → RETURN_PENDING → COMPLETED)', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('borrower can return without going through formal handoff steps', async ({ request, browser }) => {
		const user1Api = new TestAPI(request);

		const circle = await user1Api.createCircle({ name: `Informal Handoff Circle ${Date.now()}` });
		const item = await user1Api.createItem({ name: `Informal Item ${Date.now()}`, circleIds: [circle.id] });

		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Request = user2Context.request;
		const user2Api = new TestAPI(user2Request);
		await user2Api.joinCircle(circle.inviteCode);
		const borrowRequest = await user2Api.createBorrowRequest({
			itemId: item.id,
			desiredFrom: dateHelpers.tomorrow(),
			desiredTo: dateHelpers.nextWeek(),
		});

		await user1Api.approveBorrowRequest(borrowRequest.id);

		// Skip handoff/receive — go directly to return
		const returned = (await user2Api.markReturn(borrowRequest.id)) as { transaction: { status: string } };
		expect(returned.transaction.status).toBe('RETURN_PENDING');

		// Lender confirms
		const confirmed = (await user1Api.confirmReturn(borrowRequest.id)) as { transaction: { status: string } };
		expect(confirmed.transaction.status).toBe('COMPLETED');

		await user2Context.close();
	});
});

// ─── LENDER_CONFIRMED → Return Path ──────────────────────────────────────────

test.describe('LENDER_CONFIRMED return path (lender confirms handoff, borrower returns without receipt confirmation)', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('borrower can mark return after lender confirms handoff without confirming receipt', async ({
		request,
		browser,
	}) => {
		const user1Api = new TestAPI(request);

		const circle = await user1Api.createCircle({ name: `Lender Confirmed Circle ${Date.now()}` });
		const item = await user1Api.createItem({
			name: `Lender Confirmed Item ${Date.now()}`,
			circleIds: [circle.id],
		});

		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Request = user2Context.request;
		const user2Api = new TestAPI(user2Request);
		await user2Api.joinCircle(circle.inviteCode);
		const borrowRequest = await user2Api.createBorrowRequest({
			itemId: item.id,
			desiredFrom: dateHelpers.tomorrow(),
			desiredTo: dateHelpers.nextWeek(),
		});

		await user1Api.approveBorrowRequest(borrowRequest.id);

		// Lender confirms handoff
		const handoff = (await user1Api.confirmHandoff(borrowRequest.id)) as { transaction: { status: string } };
		expect(handoff.transaction.status).toBe('LENDER_CONFIRMED');

		// Borrower skips receipt and goes straight to return
		const returned = (await user2Api.markReturn(borrowRequest.id)) as { transaction: { status: string } };
		expect(returned.transaction.status).toBe('RETURN_PENDING');

		// Complete
		const confirmed = (await user1Api.confirmReturn(borrowRequest.id)) as { transaction: { status: string } };
		expect(confirmed.transaction.status).toBe('COMPLETED');

		await user2Context.close();
	});
});

// ─── Invalid Transitions ──────────────────────────────────────────────────────

test.describe('invalid transitions are rejected', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('confirm-return returns 400 when transaction is ACTIVE', async ({ request, browser }) => {
		const user1Api = new TestAPI(request);

		const circle = await user1Api.createCircle({ name: `Invalid Confirm Circle ${Date.now()}` });
		const item = await user1Api.createItem({ name: `Invalid Confirm Item ${Date.now()}`, circleIds: [circle.id] });

		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Api = new TestAPI(user2Context.request);
		await user2Api.joinCircle(circle.inviteCode);
		const borrowRequest = await user2Api.createBorrowRequest({
			itemId: item.id,
			desiredFrom: dateHelpers.tomorrow(),
			desiredTo: dateHelpers.nextWeek(),
		});

		await user1Api.approveBorrowRequest(borrowRequest.id);

		// Try to confirm return when transaction is still ACTIVE
		const res = await request.post(`/api/borrow-requests/${borrowRequest.id}/confirm-return`);
		expect(res.status()).toBe(400);
		const body = (await res.json()) as { error: string };
		expect(body.error).toMatch(/mark the item as returned/i);

		// Clean up
		await user2Api.markReturn(borrowRequest.id);
		await user1Api.confirmReturn(borrowRequest.id);
		await user2Context.close();
	});

	test('receive returns 400 when transaction is ACTIVE (handoff not confirmed)', async ({
		request,
		browser,
	}) => {
		const user1Api = new TestAPI(request);

		const circle = await user1Api.createCircle({ name: `Invalid Receive Circle ${Date.now()}` });
		const item = await user1Api.createItem({ name: `Invalid Receive Item ${Date.now()}`, circleIds: [circle.id] });

		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Api = new TestAPI(user2Context.request);
		await user2Api.joinCircle(circle.inviteCode);
		const borrowRequest = await user2Api.createBorrowRequest({
			itemId: item.id,
			desiredFrom: dateHelpers.tomorrow(),
			desiredTo: dateHelpers.nextWeek(),
		});

		await user1Api.approveBorrowRequest(borrowRequest.id);

		// Borrower tries to confirm receipt before lender confirms handoff
		const res = await user2Context.request.post(`/api/borrow-requests/${borrowRequest.id}/receive`);
		expect(res.status()).toBe(400);

		// Clean up
		await user2Api.markReturn(borrowRequest.id);
		await user1Api.confirmReturn(borrowRequest.id);
		await user2Context.close();
	});

	test('handoff returns 400 when transaction is already LENDER_CONFIRMED', async ({ request, browser }) => {
		const user1Api = new TestAPI(request);

		const circle = await user1Api.createCircle({ name: `Double Handoff Circle ${Date.now()}` });
		const item = await user1Api.createItem({ name: `Double Handoff Item ${Date.now()}`, circleIds: [circle.id] });

		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Api = new TestAPI(user2Context.request);
		await user2Api.joinCircle(circle.inviteCode);
		const borrowRequest = await user2Api.createBorrowRequest({
			itemId: item.id,
			desiredFrom: dateHelpers.tomorrow(),
			desiredTo: dateHelpers.nextWeek(),
		});

		await user1Api.approveBorrowRequest(borrowRequest.id);
		await user1Api.confirmHandoff(borrowRequest.id);

		// Lender tries to confirm handoff again
		const res = await request.post(`/api/borrow-requests/${borrowRequest.id}/handoff`);
		expect(res.status()).toBe(400);

		// Clean up
		await user2Api.markReturn(borrowRequest.id);
		await user1Api.confirmReturn(borrowRequest.id);
		await user2Context.close();
	});
});
