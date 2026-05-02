import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { BorrowTransactionStatus } from '@prisma/client';

vi.mock('next-auth', () => ({
	getServerSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
	prisma: {
		borrowRequest: {
			findUnique: vi.fn(),
		},
		borrowTransaction: {
			update: vi.fn(),
		},
		borrowQueue: {
			findFirst: vi.fn(),
			update: vi.fn(),
		},
		item: {
			update: vi.fn(),
		},
		$transaction: vi.fn(),
	},
}));

vi.mock('@/lib/notify', () => ({
	queueNotification: vi.fn(),
	queueBroadcast: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { POST as handoffPOST } from '@/app/api/borrow-requests/[id]/handoff/route';
import { POST as receivePOST } from '@/app/api/borrow-requests/[id]/receive/route';
import { POST as returnPOST } from '@/app/api/borrow-requests/[id]/return/route';
import { POST as confirmReturnPOST } from '@/app/api/borrow-requests/[id]/confirm-return/route';

const makeRequest = (id: string, body?: Record<string, unknown>) =>
	new NextRequest(`http://localhost/api/borrow-requests/${id}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});

const makeParams = (id: string) => Promise.resolve({ id });

const SESSION_OWNER = { user: { id: 'owner-1', name: 'Owner' } };
const SESSION_BORROWER = { user: { id: 'borrower-1', name: 'Borrower' } };

const makeBorrowRequest = (transactionStatus: BorrowTransactionStatus) => ({
	id: 'req-1',
	itemId: 'item-1',
	requesterId: 'borrower-1',
	ownerId: 'owner-1',
	item: { id: 'item-1', name: 'Test Item' },
	requester: { id: 'borrower-1', name: 'Borrower' },
	owner: { id: 'owner-1', name: 'Owner' },
	transaction: { id: 'tx-1', status: transactionStatus },
});

// ─── /handoff ─────────────────────────────────────────────────────────────────

describe('POST /api/borrow-requests/[id]/handoff', () => {
	beforeEach(() => {
		vi.mocked(getServerSession).mockReset();
		vi.mocked(prisma.borrowRequest.findUnique).mockReset();
		vi.mocked(prisma.borrowTransaction.update).mockReset();
	});

	it('returns 400 when transaction is already LENDER_CONFIRMED', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_OWNER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.LENDER_CONFIRMED) as never,
		);

		const res = await handoffPOST(makeRequest('req-1'), { params: makeParams('req-1') });
		expect(res.status).toBe(400);
	});

	it('returns 200 when transaction is ACTIVE', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_OWNER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.ACTIVE) as never,
		);
		vi.mocked(prisma.borrowTransaction.update).mockResolvedValue({ id: 'tx-1', status: 'LENDER_CONFIRMED' } as never);

		const res = await handoffPOST(makeRequest('req-1'), { params: makeParams('req-1') });
		expect(res.status).toBe(200);
	});

	it('returns 403 when called by borrower (not owner)', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_BORROWER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.ACTIVE) as never,
		);

		const res = await handoffPOST(makeRequest('req-1'), { params: makeParams('req-1') });
		expect(res.status).toBe(403);
	});
});

// ─── /receive ─────────────────────────────────────────────────────────────────

describe('POST /api/borrow-requests/[id]/receive', () => {
	beforeEach(() => {
		vi.mocked(getServerSession).mockReset();
		vi.mocked(prisma.borrowRequest.findUnique).mockReset();
		vi.mocked(prisma.borrowTransaction.update).mockReset();
	});

	it('returns 400 when transaction is ACTIVE (lender has not confirmed handoff)', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_BORROWER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.ACTIVE) as never,
		);

		const res = await receivePOST(makeRequest('req-1'), { params: makeParams('req-1') });
		expect(res.status).toBe(400);
	});

	it('returns 200 when transaction is LENDER_CONFIRMED', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_BORROWER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.LENDER_CONFIRMED) as never,
		);
		vi.mocked(prisma.borrowTransaction.update).mockResolvedValue({
			id: 'tx-1',
			status: 'BORROWER_CONFIRMED',
		} as never);

		const res = await receivePOST(makeRequest('req-1'), { params: makeParams('req-1') });
		expect(res.status).toBe(200);
	});

	it('returns 403 when called by owner (not borrower)', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_OWNER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.LENDER_CONFIRMED) as never,
		);

		const res = await receivePOST(makeRequest('req-1'), { params: makeParams('req-1') });
		expect(res.status).toBe(403);
	});
});

// ─── /return ──────────────────────────────────────────────────────────────────

describe('POST /api/borrow-requests/[id]/return', () => {
	beforeEach(() => {
		vi.mocked(getServerSession).mockReset();
		vi.mocked(prisma.borrowRequest.findUnique).mockReset();
		vi.mocked(prisma.borrowTransaction.update).mockReset();
	});

	it('returns 200 when transaction is ACTIVE (informal handoff path)', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_BORROWER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.ACTIVE) as never,
		);
		vi.mocked(prisma.borrowTransaction.update).mockResolvedValue({ id: 'tx-1', status: 'RETURN_PENDING' } as never);

		const res = await returnPOST(makeRequest('req-1', { returnNote: null }), { params: makeParams('req-1') });
		expect(res.status).toBe(200);
	});

	it('returns 200 when transaction is LENDER_CONFIRMED (new valid path)', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_BORROWER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.LENDER_CONFIRMED) as never,
		);
		vi.mocked(prisma.borrowTransaction.update).mockResolvedValue({ id: 'tx-1', status: 'RETURN_PENDING' } as never);

		const res = await returnPOST(makeRequest('req-1', { returnNote: null }), { params: makeParams('req-1') });
		expect(res.status).toBe(200);
	});

	it('returns 200 when transaction is BORROWER_CONFIRMED (normal path)', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_BORROWER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.BORROWER_CONFIRMED) as never,
		);
		vi.mocked(prisma.borrowTransaction.update).mockResolvedValue({ id: 'tx-1', status: 'RETURN_PENDING' } as never);

		const res = await returnPOST(makeRequest('req-1', { returnNote: null }), { params: makeParams('req-1') });
		expect(res.status).toBe(200);
	});

	it('returns 400 when transaction is already RETURN_PENDING', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_BORROWER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.RETURN_PENDING) as never,
		);

		const res = await returnPOST(makeRequest('req-1', { returnNote: null }), { params: makeParams('req-1') });
		expect(res.status).toBe(400);
	});

	it('returns 400 when transaction is COMPLETED', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_BORROWER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.COMPLETED) as never,
		);

		const res = await returnPOST(makeRequest('req-1', { returnNote: null }), { params: makeParams('req-1') });
		expect(res.status).toBe(400);
	});
});

// ─── /confirm-return ──────────────────────────────────────────────────────────

describe('POST /api/borrow-requests/[id]/confirm-return', () => {
	beforeEach(() => {
		vi.mocked(getServerSession).mockReset();
		vi.mocked(prisma.borrowRequest.findUnique).mockReset();
		vi.mocked(prisma.$transaction).mockReset();
	});

	it('returns 400 when transaction is ACTIVE (strict enforcement)', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_OWNER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.ACTIVE) as never,
		);

		const res = await confirmReturnPOST(makeRequest('req-1'), { params: makeParams('req-1') });
		expect(res.status).toBe(400);
		const data = (await res.json()) as { error: string };
		expect(data.error).toMatch(/mark the item as returned/i);
	});

	it('returns 400 when transaction is LENDER_CONFIRMED (strict enforcement)', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_OWNER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.LENDER_CONFIRMED) as never,
		);

		const res = await confirmReturnPOST(makeRequest('req-1'), { params: makeParams('req-1') });
		expect(res.status).toBe(400);
	});

	it('returns 400 when transaction is BORROWER_CONFIRMED (strict enforcement)', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_OWNER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.BORROWER_CONFIRMED) as never,
		);

		const res = await confirmReturnPOST(makeRequest('req-1'), { params: makeParams('req-1') });
		expect(res.status).toBe(400);
	});

	it('returns 200 when transaction is RETURN_PENDING (valid path)', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_OWNER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.RETURN_PENDING) as never,
		);
		vi.mocked(prisma.$transaction).mockImplementation(async fn => {
			const mockTx = {
				borrowTransaction: { update: vi.fn().mockResolvedValue({ id: 'tx-1', status: 'COMPLETED' }) },
				item: { update: vi.fn().mockResolvedValue({}) },
				borrowQueue: { findFirst: vi.fn().mockResolvedValue(null), update: vi.fn() },
			};
			return fn(mockTx as never);
		});

		const res = await confirmReturnPOST(makeRequest('req-1'), { params: makeParams('req-1') });
		expect(res.status).toBe(200);
	});

	it('returns 403 when called by borrower (not owner)', async () => {
		vi.mocked(getServerSession).mockResolvedValue(SESSION_BORROWER as never);
		vi.mocked(prisma.borrowRequest.findUnique).mockResolvedValue(
			makeBorrowRequest(BorrowTransactionStatus.RETURN_PENDING) as never,
		);

		const res = await confirmReturnPOST(makeRequest('req-1'), { params: makeParams('req-1') });
		expect(res.status).toBe(403);
	});
});
