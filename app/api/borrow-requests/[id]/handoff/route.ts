import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BorrowTransactionStatus, NotificationType } from '@prisma/client';
import { queueNotification, queueBroadcast } from '@/lib/notify';

// POST /api/borrow-requests/[id]/handoff - Lender confirms item handoff
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
				requester: { select: { id: true, name: true } },
				transaction: true,
			},
		});

		if (!borrowRequest) {
			return NextResponse.json({ error: 'Borrow request not found' }, { status: 404 });
		}

		// Only the owner/lender can confirm handoff
		if (borrowRequest.ownerId !== userId) {
			return NextResponse.json({ error: 'Only the lender can confirm handoff' }, { status: 403 });
		}

		if (!borrowRequest.transaction) {
			return NextResponse.json({ error: 'No active transaction found' }, { status: 400 });
		}

		if (borrowRequest.transaction.status !== BorrowTransactionStatus.ACTIVE) {
			return NextResponse.json(
				{ error: 'Transaction must be in ACTIVE state for handoff confirmation' },
				{ status: 400 },
			);
		}

		const updatedTransaction = await prisma.borrowTransaction.update({
			where: { id: borrowRequest.transaction.id },
			data: { status: BorrowTransactionStatus.LENDER_CONFIRMED },
		});

		queueNotification({
			userId: borrowRequest.requesterId,
			type: NotificationType.ITEM_HANDOFF_CONFIRMED,
			entityId: borrowRequest.id,
			title: 'Item Handed Off',
			body: `${session.user.name || 'The lender'} has confirmed handing off "${borrowRequest.item.name}". Please confirm when you receive it.`,
			metadata: {
				borrowRequestId: borrowRequest.id,
				transactionId: updatedTransaction.id,
				itemId: borrowRequest.item.id,
				itemName: borrowRequest.item.name,
				ownerName: session.user.name,
			},
		});

		queueBroadcast(`notifications:${borrowRequest.requesterId}`, 'transaction_updated', {
			transactionId: updatedTransaction.id,
			status: 'LENDER_CONFIRMED',
		});
		queueBroadcast(`notifications:${borrowRequest.ownerId}`, 'transaction_updated', {
			transactionId: updatedTransaction.id,
			status: 'LENDER_CONFIRMED',
		});

		return NextResponse.json({ message: 'Handoff confirmed', transaction: updatedTransaction }, { status: 200 });
	} catch (error) {
		console.error('Handoff confirmation error:', error);
		return NextResponse.json({ error: 'Failed to confirm handoff' }, { status: 500 });
	}
}
