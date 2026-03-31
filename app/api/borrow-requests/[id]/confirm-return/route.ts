import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BorrowTransactionStatus, BorrowQueueStatus, NotificationType } from '@prisma/client';
import { queueNotification, queueBroadcast } from '@/lib/notify';

// POST /api/borrow-requests/[id]/confirm-return - Owner confirms item return
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;

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

		// Only the owner can confirm return
		if (borrowRequest.ownerId !== userId) {
			return NextResponse.json({ error: 'Only the owner can confirm the return' }, { status: 403 });
		}

		// Check if there's a transaction pending return
		if (!borrowRequest.transaction) {
			return NextResponse.json({ error: 'No transaction found' }, { status: 400 });
		}

		// Transaction must be return_pending or in an active borrowing state
		const confirmableStatuses: BorrowTransactionStatus[] = [
			BorrowTransactionStatus.RETURN_PENDING,
			BorrowTransactionStatus.ACTIVE,
			BorrowTransactionStatus.LENDER_CONFIRMED,
			BorrowTransactionStatus.BORROWER_CONFIRMED,
		];
		if (!confirmableStatuses.includes(borrowRequest.transaction.status)) {
			return NextResponse.json({ error: 'Transaction cannot be completed at this stage' }, { status: 400 });
		}

		// Use transaction to complete everything atomically
		const result = await prisma.$transaction(async tx => {
			// Complete the transaction
			const updatedTransaction = await tx.borrowTransaction.update({
				where: { id: borrowRequest.transaction!.id },
				data: {
					status: BorrowTransactionStatus.COMPLETED,
					returnedAt: new Date(),
				},
			});

			// Mark item as available
			await tx.item.update({
				where: { id: borrowRequest.itemId },
				data: { isAvailable: true },
			});

			// Check if there's someone in queue for this item
			const nextInQueue = await tx.borrowQueue.findFirst({
				where: {
					itemId: borrowRequest.itemId,
					status: BorrowQueueStatus.WAITING,
				},
				orderBy: {
					position: 'asc',
				},
				include: {
					requester: {
						select: {
							id: true,
							name: true,
						},
					},
				},
			});

			if (nextInQueue) {
				// Update queue entry to ready
				await tx.borrowQueue.update({
					where: { id: nextInQueue.id },
					data: { status: BorrowQueueStatus.READY },
				});
			}

			return { updatedTransaction, nextInQueue };
		});

		queueNotification({
			userId: borrowRequest.requesterId,
			type: NotificationType.RETURN_CONFIRMED,
			entityId: borrowRequest.id,
			title: 'Return Confirmed',
			body: `Your return of "${borrowRequest.item.name}" has been confirmed. Thank you!`,
			metadata: {
				borrowRequestId: borrowRequest.id,
				transactionId: result.updatedTransaction.id,
				itemId: borrowRequest.itemId,
				itemName: borrowRequest.item.name,
			},
		});

		if (result.nextInQueue) {
			queueNotification({
				userId: result.nextInQueue.requesterId,
				type: NotificationType.QUEUE_ITEM_READY,
				entityId: result.nextInQueue.id,
				title: 'Item Now Available',
				body: `"${borrowRequest.item.name}" is now available! You're next in line.`,
				metadata: {
					queueEntryId: result.nextInQueue.id,
					itemId: borrowRequest.itemId,
					itemName: borrowRequest.item.name,
				},
			});
		}

		queueBroadcast(`notifications:${borrowRequest.requesterId}`, 'transaction_updated', {
			transactionId: result.updatedTransaction.id,
			status: 'COMPLETED',
		});
		queueBroadcast(`notifications:${borrowRequest.ownerId}`, 'transaction_updated', {
			transactionId: result.updatedTransaction.id,
			status: 'COMPLETED',
		});
		if (result.nextInQueue) {
			queueBroadcast(`notifications:${result.nextInQueue.requesterId}`, 'request_status_changed', {
				queueEntryId: result.nextInQueue.id,
				status: 'READY',
			});
		}

		return NextResponse.json(
			{
				message: 'Return confirmed successfully.',
				transaction: result.updatedTransaction,
				nextInQueue: result.nextInQueue
					? {
							id: result.nextInQueue.id,
							requester: result.nextInQueue.requester,
						}
					: null,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Confirm return error:', error);
		return NextResponse.json({ error: 'Failed to confirm return' }, { status: 500 });
	}
}
