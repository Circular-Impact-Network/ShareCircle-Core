import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
	BorrowRequestStatus,
	BorrowTransactionStatus,
	NotificationType,
} from '@prisma/client';
import { createNotification, broadcastStatusChange } from '@/lib/notifications';
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
					imageUrl: await getSignedUrl(borrowRequest.item.imagePath, 'items'),
				},
			},
			{ status: 200 }
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

			const updatedRequest = await prisma.borrowRequest.update({
				where: { id },
				data: { status: BorrowRequestStatus.CANCELLED },
			});

			return NextResponse.json(updatedRequest, { status: 200 });
		}

		// Only owner can approve/decline
		if (borrowRequest.ownerId !== userId) {
			return NextResponse.json({ error: 'Only the owner can approve or decline this request' }, { status: 403 });
		}

		if (action === 'decline') {
			const updatedRequest = await prisma.borrowRequest.update({
				where: { id },
				data: {
					status: BorrowRequestStatus.DECLINED,
					declineNote: declineNote?.trim() || null,
				},
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

			// Notify requester
			await createNotification({
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

			// Broadcast status change to both parties for realtime UI update
			await Promise.all([
				broadcastStatusChange(borrowRequest.requesterId, 'request_status_changed', { requestId: id, status: 'DECLINED' }),
				broadcastStatusChange(borrowRequest.ownerId, 'request_status_changed', { requestId: id, status: 'DECLINED' }),
			]);

			return NextResponse.json(
				{
					...updatedRequest,
					item: {
						...updatedRequest.item,
						imageUrl: await getSignedUrl(updatedRequest.item.imagePath, 'items'),
					},
				},
				{ status: 200 }
			);
		}

		if (action === 'approve') {
			// Check if item is still available
			if (!borrowRequest.item.isAvailable) {
				return NextResponse.json({ error: 'Item is no longer available' }, { status: 400 });
			}

			// Use transaction to update request, create transaction, and mark item unavailable
			const result = await prisma.$transaction(async tx => {
				// Update borrow request status
				const updatedRequest = await tx.borrowRequest.update({
					where: { id },
					data: { status: BorrowRequestStatus.APPROVED },
				});

				// Create borrow transaction
				const transaction = await tx.borrowTransaction.create({
					data: {
						borrowRequestId: id,
						itemId: borrowRequest.itemId,
						borrowerId: borrowRequest.requesterId,
						ownerId: borrowRequest.ownerId,
						dueAt: borrowRequest.desiredTo,
						status: BorrowTransactionStatus.ACTIVE,
					},
				});

				// Mark item as unavailable
				await tx.item.update({
					where: { id: borrowRequest.itemId },
					data: { isAvailable: false },
				});

				return { updatedRequest, transaction };
			});

			// Notify requester
			await createNotification({
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

			// Broadcast status change to both parties for realtime UI update
			await Promise.all([
				broadcastStatusChange(borrowRequest.requesterId, 'request_status_changed', { requestId: id, status: 'APPROVED' }),
				broadcastStatusChange(borrowRequest.ownerId, 'request_status_changed', { requestId: id, status: 'APPROVED' }),
			]);

			return NextResponse.json(
				{
					...result.updatedRequest,
					transaction: result.transaction,
					item: {
						...borrowRequest.item,
						imageUrl: await getSignedUrl(borrowRequest.item.imagePath, 'items'),
						isAvailable: false,
					},
				},
				{ status: 200 }
			);
		}

		return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
	} catch (error) {
		console.error('Update borrow request error:', error);
		return NextResponse.json({ error: 'Failed to update borrow request' }, { status: 500 });
	}
}
