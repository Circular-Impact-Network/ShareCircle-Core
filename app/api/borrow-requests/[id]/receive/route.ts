import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BorrowTransactionStatus, NotificationType } from '@prisma/client';
import { queueNotification, queueBroadcast } from '@/lib/notify';

// POST /api/borrow-requests/[id]/receive - Borrower confirms item receipt
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;

		const borrowRequest = await prisma.borrowRequest.findUnique({
			where: { id },
			include: {
				item: { select: { id: true, name: true } },
				owner: { select: { id: true, name: true } },
				transaction: true,
			},
		});

		if (!borrowRequest) {
			return NextResponse.json({ error: 'Borrow request not found' }, { status: 404 });
		}

		// Only the borrower can confirm receipt
		if (borrowRequest.requesterId !== userId) {
			return NextResponse.json({ error: 'Only the borrower can confirm receipt' }, { status: 403 });
		}

		if (!borrowRequest.transaction) {
			return NextResponse.json({ error: 'No active transaction found' }, { status: 400 });
		}

		if (borrowRequest.transaction.status !== BorrowTransactionStatus.LENDER_CONFIRMED) {
			return NextResponse.json(
				{ error: 'Lender must confirm handoff before borrower can confirm receipt' },
				{ status: 400 },
			);
		}

		const updatedTransaction = await prisma.borrowTransaction.update({
			where: { id: borrowRequest.transaction.id },
			data: { status: BorrowTransactionStatus.BORROWER_CONFIRMED },
		});

		queueNotification({
			userId: borrowRequest.ownerId,
			type: NotificationType.ITEM_RECEIVED_CONFIRMED,
			entityId: borrowRequest.id,
			title: 'Item Received',
			body: `${session.user.name || 'The borrower'} has confirmed receiving "${borrowRequest.item.name}".`,
			metadata: {
				borrowRequestId: borrowRequest.id,
				transactionId: updatedTransaction.id,
				itemId: borrowRequest.item.id,
				itemName: borrowRequest.item.name,
				borrowerName: session.user.name,
			},
		});

		queueBroadcast(`notifications:${borrowRequest.ownerId}`, 'transaction_updated', {
			transactionId: updatedTransaction.id,
			status: 'BORROWER_CONFIRMED',
		});
		queueBroadcast(`notifications:${borrowRequest.requesterId}`, 'transaction_updated', {
			transactionId: updatedTransaction.id,
			status: 'BORROWER_CONFIRMED',
		});

		return NextResponse.json({ message: 'Receipt confirmed', transaction: updatedTransaction }, { status: 200 });
	} catch (error) {
		console.error('Receipt confirmation error:', error);
		return NextResponse.json({ error: 'Failed to confirm receipt' }, { status: 500 });
	}
}
