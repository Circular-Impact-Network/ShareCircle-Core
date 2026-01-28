import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BorrowTransactionStatus, NotificationType } from '@prisma/client';
import { createNotification, broadcastStatusChange } from '@/lib/notifications';

// POST /api/borrow-requests/[id]/return - Borrower marks item as returned
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;
		const body = await req.json();
		const { returnNote } = body;

		// Get the borrow request with transaction
		const borrowRequest = await prisma.borrowRequest.findUnique({
			where: { id },
			include: {
				item: {
					select: {
						id: true,
						name: true,
					},
				},
				requester: {
					select: {
						id: true,
						name: true,
					},
				},
				owner: {
					select: {
						id: true,
						name: true,
					},
				},
				transaction: true,
			},
		});

		if (!borrowRequest) {
			return NextResponse.json({ error: 'Borrow request not found' }, { status: 404 });
		}

		// Only the borrower can mark as returned
		if (borrowRequest.requesterId !== userId) {
			return NextResponse.json({ error: 'Only the borrower can mark the item as returned' }, { status: 403 });
		}

		// Check if there's an active transaction
		if (!borrowRequest.transaction) {
			return NextResponse.json({ error: 'No active transaction found' }, { status: 400 });
		}

		// Transaction must be active
		if (borrowRequest.transaction.status !== BorrowTransactionStatus.ACTIVE) {
			return NextResponse.json({ error: 'Transaction is not active' }, { status: 400 });
		}

		// Update transaction to return pending
		const updatedTransaction = await prisma.borrowTransaction.update({
			where: { id: borrowRequest.transaction.id },
			data: {
				status: BorrowTransactionStatus.RETURN_PENDING,
				returnNote: returnNote?.trim() || null,
			},
		});

		// Notify owner to confirm return
		await createNotification({
			userId: borrowRequest.ownerId,
			type: NotificationType.RETURN_REQUESTED,
			entityId: borrowRequest.id,
			title: 'Return Confirmation Needed',
			body: `${session.user.name || 'The borrower'} has marked "${borrowRequest.item.name}" as returned. Please confirm.`,
			metadata: {
				borrowRequestId: borrowRequest.id,
				transactionId: updatedTransaction.id,
				itemId: borrowRequest.itemId,
				itemName: borrowRequest.item.name,
				borrowerName: session.user.name,
				returnNote,
			},
		});

		// Broadcast status change to both parties for realtime UI update
		await Promise.all([
			broadcastStatusChange(borrowRequest.requesterId, 'transaction_updated', { transactionId: updatedTransaction.id, status: 'RETURN_PENDING' }),
			broadcastStatusChange(borrowRequest.ownerId, 'transaction_updated', { transactionId: updatedTransaction.id, status: 'RETURN_PENDING' }),
		]);

		return NextResponse.json(
			{
				message: 'Return marked successfully. Waiting for owner confirmation.',
				transaction: updatedTransaction,
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error('Mark return error:', error);
		return NextResponse.json({ error: 'Failed to mark item as returned' }, { status: 500 });
	}
}
