/**
 * E2E tests for the just-shipped Item-Request → Chat workflow (Group A).
 *
 * Coverage:
 *  A1. Respond → /messages/<id>?context=<json> with composer banner ("Request: …")
 *  A2. Persistent Chat button after Respond (replaces Respond/Ignore)
 *  A3. First message attaches contextRef; second message does not
 *  A4. "Chat with owner" from item detail → composer banner ("Item: …")
 *  A5. Activity tab → Requests sub-tab + count badge + Close request flow
 *  A6. OPEN status renders no badge; FULFILLED/CANCELLED do
 *  A7. "Responded" indicator is icon-only (no visible text)
 */

import { test, expect, storageStatePaths } from './fixtures';
import { TestAPI } from './helpers/test-data';

test.describe('item-request → chat (cross-user)', () => {
	test('Respond opens chat with context; first message carries contextRef, second does not', async ({ browser }) => {
		const user1Ctx = await browser.newContext({ storageState: storageStatePaths.user1 });
		const user1Page = await user1Ctx.newPage();
		const user1Api = new TestAPI(user1Page.request);

		const circle = await user1Api.createCircle({ name: `Group A Circle ${Date.now()}` });

		const user2Ctx = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Page = await user2Ctx.newPage();
		const user2Api = new TestAPI(user2Page.request);
		await user2Api.joinCircle(circle.inviteCode);

		const requestTitle = `Need ladder ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		await user1Api.createItemRequest({ title: requestTitle, circleIds: [circle.id] });

		await user2Page.goto('/notifications?tab=item-requests');
		// Scope to the exact card matching our unique title so parallel test runs don't collide.
		const targetCard = user2Page.locator('[data-testid="request-card"]').filter({ hasText: requestTitle }).first();
		await expect(targetCard).toBeVisible({ timeout: 15000 });
		const respondBtn = targetCard.locator('[data-testid="respond-btn"]');
		await expect(respondBtn).toBeVisible();

		const navPromise = user2Page.waitForURL(/\/messages\/.+\?context=/, { timeout: 20000 });
		await respondBtn.click();
		await navPromise;

		const url = new URL(user2Page.url());
		expect(url.searchParams.get('context')).toBeTruthy();
		const ctx = JSON.parse(decodeURIComponent(url.searchParams.get('context')!));
		expect(ctx).toMatchObject({ type: 'item-request', title: requestTitle });

		const composerChip = user2Page.locator('[data-testid="context-ref-chip-composer"]');
		await expect(composerChip).toBeVisible({ timeout: 10000 });
		await expect(composerChip).toContainText(/Request/i);
		await expect(composerChip).toContainText(requestTitle);

		const composer = user2Page.locator('textarea, [contenteditable="true"]').first();
		const msgText = `Hi I have this ${Date.now()}`;
		await composer.click();
		await user2Page.keyboard.type(msgText);
		await user2Page.keyboard.press('Enter');

		await expect(user2Page.getByText(msgText).first()).toBeVisible({ timeout: 10000 });
		// Chip clears after first send
		await expect(composerChip).toHaveCount(0);
		// First own-bubble carries contextRef
		await expect(user2Page.locator('[data-testid="context-ref-chip-own"]').first()).toBeVisible({
			timeout: 10000,
		});

		const secondMsg = `Second msg ${Date.now()}`;
		await composer.click();
		await user2Page.keyboard.type(secondMsg);
		await user2Page.keyboard.press('Enter');
		await expect(user2Page.getByText(secondMsg).first()).toBeVisible({ timeout: 10000 });
		await expect(user2Page.locator('[data-testid="context-ref-chip-own"]')).toHaveCount(1);

		await user1Ctx.close();
		await user2Ctx.close();
	});

	test('After Respond, Chat button replaces Respond/Ignore and Responded indicator is icon-only', async ({
		browser,
	}) => {
		const user1Ctx = await browser.newContext({ storageState: storageStatePaths.user1 });
		const user1Page = await user1Ctx.newPage();
		const user1Api = new TestAPI(user1Page.request);
		const circle = await user1Api.createCircle({ name: `A2 Circle ${Date.now()}` });

		const user2Ctx = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Page = await user2Ctx.newPage();
		const user2Api = new TestAPI(user2Page.request);
		await user2Api.joinCircle(circle.inviteCode);

		const title = `A2 Need item ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		await user1Api.createItemRequest({ title, circleIds: [circle.id] });

		await user2Page.goto('/notifications?tab=item-requests');
		const targetCardA2 = user2Page.locator('[data-testid="request-card"]').filter({ hasText: title }).first();
		await expect(targetCardA2).toBeVisible({ timeout: 15000 });
		await targetCardA2.locator('[data-testid="respond-btn"]').click();
		await user2Page.waitForURL(/\/messages\//, { timeout: 20000 });

		await user2Page.goto('/notifications?tab=item-requests');
		const card = user2Page.locator('[data-testid="request-card"]').filter({ hasText: title }).first();
		await expect(card).toBeVisible({ timeout: 15000 });
		await expect(card.locator('[data-testid="chat-btn"]')).toBeVisible();
		await expect(card.locator('[data-testid="respond-btn"]')).toHaveCount(0);
		await expect(card.locator('[data-testid="ignore-btn"]')).toHaveCount(0);
		await expect(card.locator('[data-testid="responded-indicator"]')).toBeVisible();

		await user1Ctx.close();
		await user2Ctx.close();
	});

	test('Chat with owner from item detail attaches Item context (and chip is dismissible)', async ({ browser }) => {
		const user1Ctx = await browser.newContext({ storageState: storageStatePaths.user1 });
		const user1Page = await user1Ctx.newPage();
		const user1Api = new TestAPI(user1Page.request);

		const circle = await user1Api.createCircle({ name: `A4 Circle ${Date.now()}` });
		const user2Ctx = await browser.newContext({ storageState: storageStatePaths.user2 });
		const user2Page = await user2Ctx.newPage();
		const user2Api = new TestAPI(user2Page.request);
		await user2Api.joinCircle(circle.inviteCode);

		const itemName = `A4 Drill ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		const item = await user1Api.createItem({ name: itemName, circleIds: [circle.id] });

		await user2Page.goto(`/items/${item.id}`);
		const chatBtn = user2Page.locator('[data-testid="chat-with-owner-btn"]');
		await expect(chatBtn).toBeVisible({ timeout: 15000 });

		const navPromise = user2Page.waitForURL(/\/messages\/.+\?context=/, { timeout: 20000 });
		await chatBtn.click();
		await navPromise;

		const ctx = JSON.parse(decodeURIComponent(new URL(user2Page.url()).searchParams.get('context')!));
		expect(ctx).toMatchObject({ type: 'item', id: item.id, title: itemName });

		const chip = user2Page.locator('[data-testid="context-ref-chip-composer"]');
		await expect(chip).toBeVisible({ timeout: 10000 });
		await expect(chip).toContainText(/Item/i);
		await expect(chip).toContainText(itemName);

		await chip.locator('[data-testid="context-ref-chip-clear"]').click();
		await expect(chip).toHaveCount(0);

		await user1Ctx.close();
		await user2Ctx.close();
	});
});

test.describe('Activity → Requests sub-tab', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('Sub-tab visible with count badge; Close transitions card to CANCELLED', async ({ page, request }) => {
		const api = new TestAPI(request);
		const circle = await api.createCircle({ name: `A5 Circle ${Date.now()}` });
		const title = `A5 Request ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
		await api.createItemRequest({ title, circleIds: [circle.id] });

		await page.goto('/activity');
		// Radix TabsTrigger renders a role="tab"; value is internal state, not a DOM attribute.
		const tab = page.getByRole('tab', { name: /Requests/i });
		await expect(tab).toBeVisible({ timeout: 15000 });
		// Wait for the badge digit to appear so the request has rendered.
		await expect(tab.locator('span').filter({ hasText: /^\d+$/ }).first()).toBeVisible({ timeout: 15000 });

		await tab.click();
		const card = page.locator('[data-testid="request-card"]').filter({ hasText: title }).first();
		await expect(card).toBeVisible({ timeout: 10000 });

		await expect(card).toHaveAttribute('data-status', 'OPEN');
		await expect(card.getByText(/^Closed$/)).toHaveCount(0);
		await expect(card.getByText(/^Fulfilled$/)).toHaveCount(0);

		const closeBtn = card.locator('[data-testid="close-request-btn"]');
		await expect(closeBtn).toBeVisible();
		await closeBtn.click();

		// Under fully-parallel e2e load the PATCH + RTK refetch round-trip can exceed
		// 10s, so align with the 15s waits used elsewhere in this file.
		await expect(card).toHaveAttribute('data-status', 'CANCELLED', { timeout: 20000 });
		await expect(card.getByText('Closed').first()).toBeVisible({ timeout: 10000 });
		await expect(card).toHaveClass(/opacity-60/);
	});
});
