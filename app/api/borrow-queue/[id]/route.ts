import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BorrowQueueStatus, NotificationType } from '@prisma/client';
import { queueNotification } from '@/lib/notify';

// DELETE /api/borrow-queue/[id] - Leave queue (requester) or remove from queue (owner)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;

		const queueEntry = await prisma.borrowQueue.findUnique({
			where: { id },
			include: {
				item: {
					select: {
						id: true,
						name: true,
						ownerId: true,
					},
				},
				requester: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		});

		if (!queueEntry) {
			return NextResponse.json({ error: 'Queue entry not found' }, { status: 404 });
		}

		// Only requester or item owner can remove from queue
		if (queueEntry.requesterId !== userId && queueEntry.item.ownerId !== userId) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		// Update queue entry status
		await prisma.borrowQueue.update({
			where: { id },
			data: { status: BorrowQueueStatus.CANCELLED },
		});

		// Reposition remaining queue entries
		await prisma.$executeRaw`
			UPDATE borrow_queue
			SET position = position - 1
			WHERE item_id = ${queueEntry.itemId}
			  AND position > ${queueEntry.position}
			  AND status = 'WAITING'
		`;

		if (queueEntry.item.ownerId === userId && queueEntry.requesterId !== userId) {
			queueNotification({
				userId: queueEntry.requesterId,
				type: NotificationType.QUEUE_POSITION_UPDATED,
				entityId: queueEntry.id,
				title: 'Removed from Queue',
				body: `You have been removed from the queue for "${queueEntry.item.name}"`,
				metadata: {
					itemId: queueEntry.itemId,
					itemName: queueEntry.item.name,
				},
			});
		}

		return NextResponse.json({ message: 'Removed from queue' }, { status: 200 });
	} catch (error) {
		console.error('Remove from queue error:', error);
		return NextResponse.json({ error: 'Failed to remove from queue' }, { status: 500 });
	}
}

// POST /api/borrow-queue/[id] - Convert queue entry to borrow request (when ready)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;

		const queueEntry = await prisma.borrowQueue.findUnique({
			where: { id },
			include: {
				item: {
					select: {
						id: true,
						name: true,
						ownerId: true,
						isAvailable: true,
					},
				},
			},
		});

		if (!queueEntry) {
			return NextResponse.json({ error: 'Queue entry not found' }, { status: 404 });
		}

		// Only the requester can convert their queue entry
		if (queueEntry.requesterId !== userId) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		// Must be in READY status
		if (queueEntry.status !== BorrowQueueStatus.READY) {
			return NextResponse.json({ error: 'Queue entry is not ready' }, { status: 400 });
		}

		// Item must be available
		if (!queueEntry.item.isAvailable) {
			return NextResponse.json({ error: 'Item is not available' }, { status: 400 });
		}

		// Create borrow request and update queue entry in transaction
		const result = await prisma.$transaction(async tx => {
			// Create borrow request
			const borrowRequest = await tx.borrowRequest.create({
				data: {
					itemId: queueEntry.itemId,
					requesterId: queueEntry.requesterId,
					ownerId: queueEntry.item.ownerId,
					message: queueEntry.message,
					desiredFrom: queueEntry.desiredFrom || new Date(),
					desiredTo: queueEntry.desiredTo || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 1 week
					status: 'PENDING',
				},
			});

			// Remove from queue
			await tx.borrowQueue.update({
				where: { id },
				data: { status: BorrowQueueStatus.SKIPPED }, // Mark as processed
			});

			return borrowRequest;
		});

		queueNotification({
			userId: queueEntry.item.ownerId,
			type: NotificationType.BORROW_REQUEST_RECEIVED,
			entityId: result.id,
			title: 'New Borrow Request',
			body: `${session.user.name || 'Someone'} (from queue) wants to borrow "${queueEntry.item.name}"`,
			metadata: {
				borrowRequestId: result.id,
				itemId: queueEntry.itemId,
				itemName: queueEntry.item.name,
				fromQueue: true,
			},
		});

		return NextResponse.json(
			{
				message: 'Borrow request created from queue entry',
				borrowRequest: result,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error('Convert queue entry error:', error);
		return NextResponse.json({ error: 'Failed to convert queue entry' }, { status: 500 });
	}
}
