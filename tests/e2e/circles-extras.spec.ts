/**
 * E2E tests covering gaps in the circles feature group.
 *
 * Cases:
 *   F33 — join via invite code
 *   F34 — expired / regenerated invite code rejection
 *   F35 — admin removes another member
 *   F36 — self-leave
 *   F37 — avatar upload
 *   F38 — promote / demote member roles
 */

import { test, expect, storageStatePaths } from './fixtures';
import { TestAPI, createTestImageBuffer } from './helpers/test-data';

// ─── F33: Join via invite ────────────────────────────────────────────────────

test.describe('F33 — join circle via invite code', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('user2 joining user1 circle creates a membership row', async ({ request, browser }) => {
		const user1Api = new TestAPI(request);
		const circle = await user1Api.createCircle({ name: `Join Circle ${Date.now()}` });

		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		const joinRes = await user2Context.request.post('/api/circles/join', {
			data: { code: circle.inviteCode },
		});
		expect(joinRes.ok()).toBe(true);

		// Verify membership exists by listing members as user1 (admin)
		const membersRes = await request.get(`/api/circles/${circle.id}/members`);
		expect(membersRes.status()).toBe(200);
		const members = (await membersRes.json()) as Array<{ userId: string; role: string }>;
		expect(members.length).toBeGreaterThanOrEqual(2);

		await user2Context.close();
	});
});

// ─── F34: Expired / regenerated invite ────────────────────────────────────────

test.describe('F34 — regenerated invite code invalidates the old code', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('joining with an old invite code after regeneration is rejected', async ({ request, browser }) => {
		const user1Api = new TestAPI(request);
		const circle = await user1Api.createCircle({ name: `Regen Code Circle ${Date.now()}` });
		const oldCode = circle.inviteCode;

		await test.step('admin regenerates the invite code', async () => {
			const res = await request.post(`/api/circles/${circle.id}/regenerate-code`);
			expect(res.status()).toBe(200);
			const body = (await res.json()) as { inviteCode: string };
			expect(body.inviteCode).not.toBe(oldCode);
		});

		await test.step('joining with the old code is rejected (400/404/410)', async () => {
			const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
			const joinRes = await user2Context.request.post('/api/circles/join', {
				data: { code: oldCode },
			});
			expect(joinRes.ok()).toBe(false);
			expect([400, 404, 410]).toContain(joinRes.status());
			await user2Context.close();
		});
	});
});

// ─── F35: Admin removes a member ──────────────────────────────────────────────

test.describe('F35 — admin removes another member', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('removed member loses GET access to /api/items?circleId', async ({ request, browser, users }) => {
		const user1Api = new TestAPI(request);
		const circle = await user1Api.createCircle({ name: `Remove Member Circle ${Date.now()}` });

		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		await user2Context.request.post('/api/circles/join', { data: { code: circle.inviteCode } });

		// User2 has access to the circle's items now.
		const beforeRes = await user2Context.request.get(`/api/items?circleId=${circle.id}`);
		expect(beforeRes.status()).toBe(200);

		// Admin removes user2.
		const removeRes = await request.delete(`/api/circles/${circle.id}/members/${users.user2.id}`);
		expect(removeRes.status()).toBe(200);

		// User2 no longer has access.
		const afterRes = await user2Context.request.get(`/api/items?circleId=${circle.id}`);
		// Could be 403 (forbidden) or 200 with empty list (user filtered out at query time).
		// We assert the user is NOT able to see this circle's content as a member.
		if (afterRes.status() === 200) {
			const data = (await afterRes.json()) as unknown;
			const list = Array.isArray(data) ? data : ((data as { items?: unknown[] }).items ?? []);
			expect(list.length).toBe(0);
		} else {
			expect([403, 404]).toContain(afterRes.status());
		}

		await user2Context.close();
	});
});

// ─── F36: Self-leave ──────────────────────────────────────────────────────────

test.describe('F36 — self-leave a circle', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('user2 can leave a circle via DELETE /members/[userId] with own id', async ({ request, browser, users }) => {
		const user1Api = new TestAPI(request);
		const circle = await user1Api.createCircle({ name: `Self Leave Circle ${Date.now()}` });

		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		await user2Context.request.post('/api/circles/join', { data: { code: circle.inviteCode } });

		const leaveRes = await user2Context.request.delete(`/api/circles/${circle.id}/members/${users.user2.id}`);
		expect(leaveRes.status()).toBe(200);
		const body = (await leaveRes.json()) as { message: string };
		expect(body.message).toMatch(/left circle/i);

		// User2 should no longer be a member.
		const membersRes = await request.get(`/api/circles/${circle.id}/members`);
		const members = (await membersRes.json()) as Array<{ userId: string }>;
		expect(members.some(m => m.userId === users.user2.id)).toBe(false);

		await user2Context.close();
	});
});

// ─── F37: Avatar upload ───────────────────────────────────────────────────────

test.describe('F37 — circle avatar upload', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('admin uploads avatar — avatarUrl is set on the circle', async ({ request }) => {
		const user1Api = new TestAPI(request);
		const circle = await user1Api.createCircle({ name: `Avatar Circle ${Date.now()}` });

		const buffer = createTestImageBuffer();
		const uploadRes = await request.post(`/api/circles/${circle.id}/avatar`, {
			multipart: {
				file: {
					name: 'circle-avatar.png',
					mimeType: 'image/png',
					buffer,
				},
			},
		});

		// Supabase storage may not be configured in CI. Accept either real success or a 500
		// from the storage layer (and surface as a skip in that case).
		if (uploadRes.status() === 500) {
			test.skip(true, 'Supabase storage not configured; skipping circle avatar upload assertions.');
			return;
		}
		expect(uploadRes.status()).toBe(200);

		const body = (await uploadRes.json()) as { avatarUrl: string; avatarPath: string };
		expect(body.avatarUrl).toBeTruthy();
		expect(body.avatarPath).toContain(circle.id);

		// Verify the circle resource now exposes the avatar.
		const circleRes = await request.get(`/api/circles/${circle.id}`);
		const data = (await circleRes.json()) as { avatarUrl?: string | null; avatarPath?: string | null };
		expect(data.avatarUrl || data.avatarPath).toBeTruthy();
	});
});

// ─── F38: Promote / demote member ─────────────────────────────────────────────

test.describe('F38 — promote / demote member roles', () => {
	test.use({ storageState: storageStatePaths.user1 });

	test('PUT /members/[userId] flips role between ADMIN and MEMBER', async ({ request, browser, users }) => {
		const user1Api = new TestAPI(request);
		const circle = await user1Api.createCircle({ name: `Role Flip Circle ${Date.now()}` });

		const user2Context = await browser.newContext({ storageState: storageStatePaths.user2 });
		await user2Context.request.post('/api/circles/join', { data: { code: circle.inviteCode } });

		await test.step('promote user2 to ADMIN', async () => {
			const res = await request.put(`/api/circles/${circle.id}/members/${users.user2.id}`, {
				data: { role: 'ADMIN' },
			});
			expect(res.status()).toBe(200);
			const body = (await res.json()) as { role: string };
			expect(body.role).toBe('ADMIN');
		});

		await test.step('demote user2 back to MEMBER', async () => {
			const res = await request.put(`/api/circles/${circle.id}/members/${users.user2.id}`, {
				data: { role: 'MEMBER' },
			});
			expect(res.status()).toBe(200);
			const body = (await res.json()) as { role: string };
			expect(body.role).toBe('MEMBER');
		});

		await test.step('invalid role is rejected', async () => {
			const res = await request.put(`/api/circles/${circle.id}/members/${users.user2.id}`, {
				data: { role: 'SUPERADMIN' },
			});
			expect(res.status()).toBe(400);
		});

		await user2Context.close();
	});
});
