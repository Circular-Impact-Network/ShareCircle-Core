import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BorrowRequestStatus, BorrowTransactionStatus, NotificationType } from '@prisma/client';
import { queueNotification, queueBroadcast } from '@/lib/notify';
import { getSignedUrl } from '@/lib/supabase';

// GET /api/borrow-requests/[id] - Get a single borrow request
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
				item: {
					select: {
						id: true,
						name: true,
						imagePath: true,
						isAvailable: true,
						description: true,
					},
				},
				requester: {
					select: {
						id: true,
						name: true,
						image: true,
					},
				},
				owner: {
					select: {
						id: true,
						name: true,
						image: true,
					},
				},
				transaction: true,
			},
		});

		if (!borrowRequest) {
			return NextResponse.json({ error: 'Borrow request not found' }, { status: 404 });
		}

		// Only requester or owner can view the request
		if (borrowRequest.requesterId !== userId && borrowRequest.ownerId !== userId) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		return NextResponse.json(
			{
				...borrowRequest,
				item: {
					...borrowRequest.item,
					imageUrl: await getSignedUrl(borrowRequest.item.imagePath, 'items').catch(() => ''),
				},
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Get borrow request error:', error);
		return NextResponse.json({ error: 'Failed to fetch borrow request' }, { status: 500 });
	}
}

// PATCH /api/borrow-requests/[id] - Approve or decline a borrow request
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;
		const body = await req.json();
		const { action, declineNote } = body; // action: 'approve' | 'decline' | 'cancel'

		const borrowRequest = await prisma.borrowRequest.findUnique({
			where: { id },
			include: {
				item: {
					select: {
						id: true,
						name: true,
						imagePath: true,
						isAvailable: true,
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
			},
		});

		if (!borrowRequest) {
			return NextResponse.json({ error: 'Borrow request not found' }, { status: 404 });
		}

		// Only pending requests can be approved/declined
		if (borrowRequest.status !== BorrowRequestStatus.PENDING) {
			return NextResponse.json({ error: 'Request has already been processed' }, { status: 400 });
		}

		// Validate action permissions
		if (action === 'cancel') {
			// Only requester can cancel
			if (borrowRequest.requesterId !== userId) {
				return NextResponse.json({ error: 'Only the requester can cancel this request' }, { status: 403 });
			}

			// Guarded on status so the write itself decides the race. The PENDING check above ran
			// on a row read earlier in this handler; between that read and this write the owner
			// can have approved, and an unguarded update would then produce a CANCELLED request
			// with a live ACTIVE transaction and an item stuck unavailable forever.
			const cancelled = await prisma.borrowRequest.updateMany({
				where: { id, status: BorrowRequestStatus.PENDING, requesterId: userId },
				data: { status: BorrowRequestStatus.CANCELLED },
			});

			if (cancelled.count === 0) {
				return NextResponse.json({ error: 'Request has already been processed' }, { status: 409 });
			}

			const updatedRequest = await prisma.borrowRequest.findUnique({ where: { id } });

			return NextResponse.json(updatedRequest, { status: 200 });
		}

		// Only owner can approve/decline
		if (borrowRequest.ownerId !== userId) {
			return NextResponse.json({ error: 'Only the owner can approve or decline this request' }, { status: 403 });
		}

		if (action === 'decline') {
			// Same guard as cancel: the PENDING check ran on an earlier read, so the transition
			// has to be conditional on the row still being PENDING at write time.
			const declined = await prisma.borrowRequest.updateMany({
				where: { id, status: BorrowRequestStatus.PENDING },
				data: {
					status: BorrowRequestStatus.DECLINED,
					declineNote: declineNote?.trim() || null,
				},
			});

			if (declined.count === 0) {
				return NextResponse.json({ error: 'Request has already been processed' }, { status: 409 });
			}

			const updatedRequest = await prisma.borrowRequest.findUniqueOrThrow({
				where: { id },
				include: {
					item: {
						select: {
							id: true,
							name: true,
							imagePath: true,
						},
					},
				},
			});

			queueNotification({
				userId: borrowRequest.requesterId,
				type: NotificationType.BORROW_REQUEST_DECLINED,
				entityId: borrowRequest.id,
				title: 'Borrow Request Declined',
				body: `Your request to borrow "${borrowRequest.item.name}" was declined${declineNote ? `: "${declineNote}"` : ''}`,
				metadata: {
					borrowRequestId: borrowRequest.id,
					itemId: borrowRequest.itemId,
					itemName: borrowRequest.item.name,
					ownerName: session.user.name,
					declineNote,
				},
			});

			queueBroadcast(`notifications:${borrowRequest.requesterId}`, 'request_status_changed', {
				requestId: id,
				status: 'DECLINED',
			});
			queueBroadcast(`notifications:${borrowRequest.ownerId}`, 'request_status_changed', {
				requestId: id,
				status: 'DECLINED',
			});

			return NextResponse.json(
				{
					...updatedRequest,
					item: {
						...updatedRequest.item,
						imageUrl: await getSignedUrl(updatedRequest.item.imagePath, 'items').catch(() => ''),
					},
				},
				{ status: 200 },
			);
		}

		if (action === 'approve') {
			// Check if item is still available
			if (!borrowRequest.item.isAvailable) {
				return NextResponse.json({ error: 'Item is no longer available' }, { status: 400 });
			}

			// Use transaction to update request, create transaction, and mark item unavailable
			const result = await prisma.$transaction(async tx => {
				/**
				 * Claim the item with the write itself.
				 *
				 * The previous version read with findUnique and then updated. Prisma's interactive
				 * transactions run at READ COMMITTED and a plain SELECT takes no row lock, so two
				 * concurrent approvals for the same item both saw isAvailable: true and both
				 * proceeded — two ACTIVE transactions, two borrowers, one physical item. The
				 * @unique on borrowRequestId does not catch it because the request ids differ.
				 *
				 * A conditional UPDATE is atomic: exactly one of the racers matches the
				 * `isAvailable: true` predicate and the other gets count === 0.
				 */
				const claimed = await tx.item.updateMany({
					where: { id: borrowRequest.itemId, isAvailable: true },
					data: { isAvailable: false },
				});
				if (claimed.count === 0) {
					throw new Error('ITEM_UNAVAILABLE');
				}

				// Same treatment for the request itself, so approve-racing-approve on one request
				// cannot create two transactions for it.
				const claimedRequest = await tx.borrowRequest.updateMany({
					where: { id, status: BorrowRequestStatus.PENDING },
					data: { status: BorrowRequestStatus.APPROVED },
				});
				if (claimedRequest.count === 0) {
					throw new Error('REQUEST_NOT_PENDING');
				}

				const updatedRequest = await tx.borrowRequest.findUniqueOrThrow({ where: { id } });

				// Create borrow transaction. startAt carries the requested start date so the UI can
				// distinguish a future "Reserved" booking from a "Currently borrowed" one.
				const transaction = await tx.borrowTransaction.create({
					data: {
						borrowRequestId: id,
						itemId: borrowRequest.itemId,
						borrowerId: borrowRequest.requesterId,
						ownerId: borrowRequest.ownerId,
						startAt: borrowRequest.desiredFrom,
						dueAt: borrowRequest.desiredTo,
						event: borrowRequest.event,
						status: BorrowTransactionStatus.ACTIVE,
					},
				});

				// The item was already marked unavailable by the conditional claim above — that
				// write is what won the race, so repeating it here would be redundant.

				return { updatedRequest, transaction };
			});

			queueNotification({
				userId: borrowRequest.requesterId,
				type: NotificationType.BORROW_REQUEST_APPROVED,
				entityId: borrowRequest.id,
				title: 'Borrow Request Approved',
				body: `Your request to borrow "${borrowRequest.item.name}" was approved!`,
				metadata: {
					borrowRequestId: borrowRequest.id,
					transactionId: result.transaction.id,
					itemId: borrowRequest.itemId,
					itemName: borrowRequest.item.name,
					ownerName: session.user.name,
					dueAt: borrowRequest.desiredTo.toISOString(),
				},
			});

			queueBroadcast(`notifications:${borrowRequest.requesterId}`, 'request_status_changed', {
				requestId: id,
				status: 'APPROVED',
			});
			queueBroadcast(`notifications:${borrowRequest.ownerId}`, 'request_status_changed', {
				requestId: id,
				status: 'APPROVED',
			});

			return NextResponse.json(
				{
					...result.updatedRequest,
					transaction: result.transaction,
					item: {
						...borrowRequest.item,
						imageUrl: await getSignedUrl(borrowRequest.item.imagePath, 'items').catch(() => ''),
						isAvailable: false,
					},
				},
				{ status: 200 },
			);
		}

		return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
	} catch (error) {
		if (error instanceof Error && error.message === 'ITEM_UNAVAILABLE') {
			return NextResponse.json({ error: 'Item is no longer available' }, { status: 409 });
		}
		if (error instanceof Error && error.message === 'REQUEST_NOT_PENDING') {
			return NextResponse.json({ error: 'Request has already been processed' }, { status: 409 });
		}
		console.error('Update borrow request error:', error);
		return NextResponse.json({ error: 'Failed to update borrow request' }, { status: 500 });
	}
}
