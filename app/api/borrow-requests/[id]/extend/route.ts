import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BorrowTransactionStatus, BorrowQueueStatus, BorrowRequestStatus } from '@prisma/client';

// POST /api/borrow-requests/[id]/extend - Borrower requests to extend due date
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;
		const body = await req.json();
		const { newDueAt } = body;

		if (!newDueAt) {
			return NextResponse.json({ error: 'New due date is required' }, { status: 400 });
		}

		const newDueDate = new Date(newDueAt);
		if (isNaN(newDueDate.getTime()) || newDueDate <= new Date()) {
			return NextResponse.json({ error: 'New due date must be in the future' }, { status: 400 });
		}

		const borrowRequest = await prisma.borrowRequest.findUnique({
			where: { id },
			include: {
				transaction: true,
				item: { select: { id: true, name: true } },
			},
		});

		if (!borrowRequest) {
			return NextResponse.json({ error: 'Borrow request not found' }, { status: 404 });
		}

		// Only the borrower can extend
		if (borrowRequest.requesterId !== userId) {
			return NextResponse.json({ error: 'Only the borrower can extend the borrow period' }, { status: 403 });
		}

		if (!borrowRequest.transaction) {
			return NextResponse.json({ error: 'No active transaction found' }, { status: 400 });
		}

		const extensibleStatuses: BorrowTransactionStatus[] = [
			BorrowTransactionStatus.ACTIVE,
			BorrowTransactionStatus.LENDER_CONFIRMED,
			BorrowTransactionStatus.BORROWER_CONFIRMED,
		];

		if (!extensibleStatuses.includes(borrowRequest.transaction.status)) {
			return NextResponse.json({ error: 'Transaction cannot be extended at this stage' }, { status: 400 });
		}

		if (newDueDate <= borrowRequest.transaction.dueAt) {
			return NextResponse.json(
				{ error: 'New due date must be later than the current due date' },
				{ status: 400 },
			);
		}

		// Block extension if someone has an approved borrow request for this item
		const blockingApprovedRequest = await prisma.borrowRequest.findFirst({
			where: {
				itemId: borrowRequest.itemId,
				id: { not: id },
				status: BorrowRequestStatus.APPROVED,
			},
		});

		if (blockingApprovedRequest) {
			return NextResponse.json(
				{ error: 'Extension not available: another borrow request has already been approved for this item' },
				{ status: 409 },
			);
		}

		// Block extension if someone is READY in the queue (waiting for this item to become free)
		const readyQueueEntry = await prisma.borrowQueue.findFirst({
			where: {
				itemId: borrowRequest.itemId,
				status: BorrowQueueStatus.READY,
			},
		});

		if (readyQueueEntry) {
			return NextResponse.json(
				{ error: 'Extension not available: someone is next in queue waiting for this item' },
				{ status: 409 },
			);
		}

		const updatedTransaction = await prisma.borrowTransaction.update({
			where: { id: borrowRequest.transaction.id },
			data: { dueAt: newDueDate },
		});

		return NextResponse.json(
			{
				message: 'Borrow period extended successfully',
				transaction: updatedTransaction,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Extend borrow error:', error);
		return NextResponse.json({ error: 'Failed to extend borrow period' }, { status: 500 });
	}
}
