import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MemberRole } from '@prisma/client';

vi.mock('next-auth', () => ({
	getServerSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		circleMember: { findUnique: vi.fn() },
		itemCircle: { findUnique: vi.fn(), delete: vi.fn() },
		borrowTransaction: { findFirst: vi.fn() },
		circle: { findUnique: vi.fn() },
	},
}));

vi.mock('@/lib/notify', () => ({
	queueNotification: vi.fn(),
	queueBroadcast: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { queueBroadcast } from '@/lib/notify';
import { DELETE } from '@/app/api/circles/[id]/items/[itemId]/route';

const CIRCLE_ID = 'circle-1';
const ITEM_ID = 'item-1';
const ADMIN_ID = 'admin-1';

const makeRequest = () =>
	new NextRequest(`http://localhost/api/circles/${CIRCLE_ID}/items/${ITEM_ID}`, { method: 'DELETE' });

const makeParams = () => Promise.resolve({ id: CIRCLE_ID, itemId: ITEM_ID });

const asAdmin = () => vi.mocked(getServerSession).mockResolvedValue({ user: { id: ADMIN_ID } } as never);

describe('DELETE /api/circles/[id]/items/[itemId]', () => {
	beforeEach(() => {
		vi.mocked(getServerSession).mockReset();
		vi.mocked(prisma.circleMember.findUnique).mockReset();
		vi.mocked(prisma.itemCircle.findUnique).mockReset();
		vi.mocked(prisma.itemCircle.delete).mockReset();
		vi.mocked(prisma.borrowTransaction.findFirst).mockReset();
		vi.mocked(queueBroadcast).mockReset();
	});

	it('returns 401 when not authenticated', async () => {
		vi.mocked(getServerSession).mockResolvedValue(null);

		const res = await DELETE(makeRequest(), { params: makeParams() });
		expect(res.status).toBe(401);
	});

	it('returns 403 when caller is not an active admin', async () => {
		asAdmin();
		vi.mocked(prisma.circleMember.findUnique).mockResolvedValue({
			role: MemberRole.MEMBER,
			leftAt: null,
		} as never);

		const res = await DELETE(makeRequest(), { params: makeParams() });
		expect(res.status).toBe(403);
	});

	it('returns 404 when the item is not in the circle', async () => {
		asAdmin();
		vi.mocked(prisma.circleMember.findUnique).mockResolvedValue({
			role: MemberRole.ADMIN,
			leftAt: null,
		} as never);
		vi.mocked(prisma.itemCircle.findUnique).mockResolvedValue(null);

		const res = await DELETE(makeRequest(), { params: makeParams() });
		expect(res.status).toBe(404);
	});

	it('returns 409 and does NOT delete when the item is in an active borrow', async () => {
		asAdmin();
		vi.mocked(prisma.circleMember.findUnique).mockResolvedValue({
			role: MemberRole.ADMIN,
			leftAt: null,
		} as never);
		vi.mocked(prisma.itemCircle.findUnique).mockResolvedValue({
			item: { ownerId: 'someone-else', name: 'Drill' },
		} as never);
		// An in-flight transaction (not COMPLETED/CANCELLED) blocks removal.
		vi.mocked(prisma.borrowTransaction.findFirst).mockResolvedValue({ id: 'tx-1' } as never);

		const res = await DELETE(makeRequest(), { params: makeParams() });

		expect(res.status).toBe(409);
		expect(prisma.itemCircle.delete).not.toHaveBeenCalled();
		expect(queueBroadcast).not.toHaveBeenCalled();
	});

	it('removes the item and broadcasts when there is no active borrow', async () => {
		asAdmin();
		vi.mocked(prisma.circleMember.findUnique).mockResolvedValue({
			role: MemberRole.ADMIN,
			leftAt: null,
		} as never);
		// Admin removing their own item → no owner notification path needed.
		vi.mocked(prisma.itemCircle.findUnique).mockResolvedValue({
			item: { ownerId: ADMIN_ID, name: 'Drill' },
		} as never);
		vi.mocked(prisma.borrowTransaction.findFirst).mockResolvedValue(null);
		vi.mocked(prisma.itemCircle.delete).mockResolvedValue({} as never);

		const res = await DELETE(makeRequest(), { params: makeParams() });

		expect(res.status).toBe(200);
		expect(prisma.itemCircle.delete).toHaveBeenCalledWith({
			where: { itemId_circleId: { itemId: ITEM_ID, circleId: CIRCLE_ID } },
		});
		expect(queueBroadcast).toHaveBeenCalledWith(`circle:${CIRCLE_ID}:items`, 'item_removed', {
			itemId: ITEM_ID,
			circleId: CIRCLE_ID,
		});
	});
});
