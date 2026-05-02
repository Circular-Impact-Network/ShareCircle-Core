import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth', () => ({
	getServerSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		item: {
			findUnique: vi.fn(),
			delete: vi.fn(),
		},
		borrowTransaction: {
			findFirst: vi.fn(),
		},
	},
}));

vi.mock('@/lib/supabase', () => ({
	deleteImage: vi.fn(),
}));

vi.mock('@/lib/ai', () => ({
	generateDocumentEmbedding: vi.fn(),
	buildEnrichedText: vi.fn(),
	validateListingAgainstImages: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { deleteImage } from '@/lib/supabase';
import { DELETE } from '@/app/api/items/[id]/route';

const makeRequest = (id: string) =>
	new NextRequest(`http://localhost/api/items/${id}`, { method: 'DELETE' });

const makeParams = (id: string) => Promise.resolve({ id });

describe('DELETE /api/items/[id]', () => {
	beforeEach(() => {
		vi.mocked(getServerSession).mockReset();
		vi.mocked(prisma.item.findUnique).mockReset();
		vi.mocked(prisma.item.delete).mockReset();
		vi.mocked(prisma.borrowTransaction.findFirst).mockReset();
		vi.mocked(deleteImage).mockReset();
	});

	it('returns 401 when not authenticated', async () => {
		vi.mocked(getServerSession).mockResolvedValue(null);

		const res = await DELETE(makeRequest('item-1'), { params: makeParams('item-1') });
		expect(res.status).toBe(401);
		const data = (await res.json()) as { error: string };
		expect(data.error).toBe('Unauthorized');
	});

	it('returns 404 when item not found', async () => {
		vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } } as never);
		vi.mocked(prisma.item.findUnique).mockResolvedValue(null);

		const res = await DELETE(makeRequest('item-1'), { params: makeParams('item-1') });
		expect(res.status).toBe(404);
		const data = (await res.json()) as { error: string };
		expect(data.error).toBe('Item not found');
	});

	it('returns 403 when user is not the owner', async () => {
		vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-2' } } as never);
		vi.mocked(prisma.item.findUnique).mockResolvedValue({
			ownerId: 'user-1',
			imagePath: 'items/img.jpg',
			mediaPaths: [],
		} as never);

		const res = await DELETE(makeRequest('item-1'), { params: makeParams('item-1') });
		expect(res.status).toBe(403);
		const data = (await res.json()) as { error: string };
		expect(data.error).toMatch(/only delete your own/i);
	});

	it('returns 409 when an active borrow transaction exists', async () => {
		vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } } as never);
		vi.mocked(prisma.item.findUnique).mockResolvedValue({
			ownerId: 'user-1',
			imagePath: 'items/img.jpg',
			mediaPaths: [],
		} as never);
		vi.mocked(prisma.borrowTransaction.findFirst).mockResolvedValue({ id: 'tx-1' } as never);

		const res = await DELETE(makeRequest('item-1'), { params: makeParams('item-1') });
		expect(res.status).toBe(409);
		const data = (await res.json()) as { error: string };
		expect(data.error).toMatch(/active borrow transactions/i);
		expect(prisma.item.delete).not.toHaveBeenCalled();
	});

	it('returns 200 and deletes item when no active borrows', async () => {
		vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } } as never);
		vi.mocked(prisma.item.findUnique).mockResolvedValue({
			ownerId: 'user-1',
			imagePath: 'items/img.jpg',
			mediaPaths: [],
		} as never);
		vi.mocked(prisma.borrowTransaction.findFirst).mockResolvedValue(null);
		vi.mocked(prisma.item.delete).mockResolvedValue({} as never);
		vi.mocked(deleteImage).mockResolvedValue(undefined);

		const res = await DELETE(makeRequest('item-1'), { params: makeParams('item-1') });
		expect(res.status).toBe(200);
		expect(prisma.item.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
	});

	it('returns 200 even when storage deletion fails (DB already deleted)', async () => {
		vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'user-1' } } as never);
		vi.mocked(prisma.item.findUnique).mockResolvedValue({
			ownerId: 'user-1',
			imagePath: 'items/img.jpg',
			mediaPaths: ['media/a.jpg'],
		} as never);
		vi.mocked(prisma.borrowTransaction.findFirst).mockResolvedValue(null);
		vi.mocked(prisma.item.delete).mockResolvedValue({} as never);
		vi.mocked(deleteImage).mockRejectedValue(new Error('Storage unavailable'));

		const res = await DELETE(makeRequest('item-1'), { params: makeParams('item-1') });
		expect(res.status).toBe(200);
		expect(prisma.item.delete).toHaveBeenCalled();
	});
});
