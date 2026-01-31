import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BorrowRequestStatus, BorrowQueueStatus, NotificationType } from '@prisma/client';
import { createNotification } from '@/lib/notifications';
import { getSignedUrl } from '@/lib/supabase';

// GET /api/borrow-requests - Get borrow requests
export async function GET(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const type = req.nextUrl.searchParams.get('type'); // 'incoming' | 'outgoing' | 'all'
		const status = req.nextUrl.searchParams.get('status') as BorrowRequestStatus | null;
		const itemId = req.nextUrl.searchParams.get('itemId');

		// Build where clause based on type
		const whereClause: {
			requesterId?: string;
			ownerId?: string;
			OR?: Array<{ requesterId: string } | { ownerId: string }>;
			status?: BorrowRequestStatus;
			itemId?: string;
		} = {};

		if (type === 'incoming') {
			whereClause.ownerId = userId;
		} else if (type === 'outgoing') {
			whereClause.requesterId = userId;
		} else {
			// Default: show both incoming and outgoing
			whereClause.OR = [{ requesterId: userId }, { ownerId: userId }];
		}

		if (status) {
			whereClause.status = status;
		}

		if (itemId) {
			whereClause.itemId = itemId;
		}

		const borrowRequests = await prisma.borrowRequest.findMany({
			where: whereClause,
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
				transaction: {
					select: {
						id: true,
						status: true,
						borrowedAt: true,
						dueAt: true,
						returnedAt: true,
					},
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		// Add signed URLs for item images
		const requestsWithUrls = await Promise.all(
			borrowRequests.map(async request => ({
				...request,
				item: {
					...request.item,
					imageUrl: await getSignedUrl(request.item.imagePath, 'items'),
				},
			}))
		);

		return NextResponse.json(requestsWithUrls, { status: 200 });
	} catch (error) {
		console.error('Get borrow requests error:', error);
		return NextResponse.json({ error: 'Failed to fetch borrow requests' }, { status: 500 });
	}
}

// POST /api/borrow-requests - Create a borrow request (or join queue)
export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const body = await req.json();
		const { itemId, message, desiredFrom, desiredTo, joinQueue } = body;

		// Validate required fields
		if (!itemId) {
			return NextResponse.json({ error: 'Item ID is required' }, { status: 400 });
		}

		if (!desiredFrom || !desiredTo) {
			return NextResponse.json({ error: 'Desired dates are required' }, { status: 400 });
		}

		// Get the item with owner info
		const item = await prisma.item.findUnique({
			where: { id: itemId },
			include: {
				owner: {
					select: {
						id: true,
						name: true,
					},
				},
				circles: {
					select: {
						circleId: true,
					},
				},
			},
		});

		if (!item) {
			return NextResponse.json({ error: 'Item not found' }, { status: 404 });
		}

		// User cannot request their own item
		if (item.ownerId === userId) {
			return NextResponse.json({ error: 'You cannot borrow your own item' }, { status: 400 });
		}

		// Verify user is in at least one circle where the item is shared
		const userCircles = await prisma.circleMember.findMany({
			where: {
				userId,
				leftAt: null,
			},
			select: {
				circleId: true,
			},
		});

		const userCircleIds = userCircles.map(c => c.circleId);
		const itemCircleIds = item.circles.map(c => c.circleId);
		const hasAccess = itemCircleIds.some(cId => userCircleIds.includes(cId));

		if (!hasAccess) {
			return NextResponse.json({ error: 'You do not have access to this item' }, { status: 403 });
		}

		// Check if user already has a pending request for this item
		const existingRequest = await prisma.borrowRequest.findFirst({
			where: {
				itemId,
				requesterId: userId,
				status: BorrowRequestStatus.PENDING,
			},
		});

		if (existingRequest) {
			return NextResponse.json({ error: 'You already have a pending request for this item' }, { status: 400 });
		}

		// If item is not available and user wants to join queue
		if (!item.isAvailable && joinQueue) {
			// Check if user is already in queue
			const existingQueueEntry = await prisma.borrowQueue.findFirst({
				where: {
					itemId,
					requesterId: userId,
					status: BorrowQueueStatus.WAITING,
				},
			});

			if (existingQueueEntry) {
				return NextResponse.json({ error: 'You are already in the queue for this item' }, { status: 400 });
			}

			// Get current queue position
			const lastQueueEntry = await prisma.borrowQueue.findFirst({
				where: {
					itemId,
					status: BorrowQueueStatus.WAITING,
				},
				orderBy: {
					position: 'desc',
				},
			});

			const nextPosition = (lastQueueEntry?.position || 0) + 1;

			// Add to queue
			const queueEntry = await prisma.borrowQueue.create({
				data: {
					itemId,
					requesterId: userId,
					position: nextPosition,
					message: message?.trim() || null,
					desiredFrom: new Date(desiredFrom),
					desiredTo: new Date(desiredTo),
					status: BorrowQueueStatus.WAITING,
				},
				include: {
					item: {
						select: {
							id: true,
							name: true,
							imagePath: true,
						},
					},
					requester: {
						select: {
							id: true,
							name: true,
							image: true,
						},
					},
				},
			});

			// Notify owner about queue entry
			await createNotification({
				userId: item.ownerId,
				type: NotificationType.QUEUE_POSITION_UPDATED,
				entityId: queueEntry.id,
				title: 'New Queue Entry',
				body: `${session.user.name || 'Someone'} joined the queue for "${item.name}"`,
				metadata: {
					queueEntryId: queueEntry.id,
					itemId,
					itemName: item.name,
					requesterId: userId,
					requesterName: session.user.name,
					position: nextPosition,
				},
			});

			return NextResponse.json(
				{
					type: 'queue',
					queueEntry: {
						...queueEntry,
						item: {
							...queueEntry.item,
							imageUrl: await getSignedUrl(queueEntry.item.imagePath, 'items'),
						},
					},
				},
				{ status: 201 }
			);
		}

		// If item is not available and user didn't opt to join queue
		if (!item.isAvailable && !joinQueue) {
			return NextResponse.json(
				{ error: 'Item is not available. You can join the queue instead.' },
				{ status: 400 }
			);
		}

		// Create borrow request
		const borrowRequest = await prisma.borrowRequest.create({
			data: {
				itemId,
				requesterId: userId,
				ownerId: item.ownerId,
				message: message?.trim() || null,
				desiredFrom: new Date(desiredFrom),
				desiredTo: new Date(desiredTo),
				status: BorrowRequestStatus.PENDING,
			},
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
			},
		});

		// Notify owner about the borrow request
		await createNotification({
			userId: item.ownerId,
			type: NotificationType.BORROW_REQUEST_RECEIVED,
			entityId: borrowRequest.id,
			title: 'New Borrow Request',
			body: `${session.user.name || 'Someone'} wants to borrow "${item.name}"`,
			metadata: {
				borrowRequestId: borrowRequest.id,
				itemId,
				itemName: item.name,
				requesterId: userId,
				requesterName: session.user.name,
				desiredFrom,
				desiredTo,
			},
		});

		return NextResponse.json(
			{
				type: 'request',
				borrowRequest: {
					...borrowRequest,
					item: {
						...borrowRequest.item,
						imageUrl: await getSignedUrl(borrowRequest.item.imagePath, 'items'),
					},
				},
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Create borrow request error:', error);
		return NextResponse.json({ error: 'Failed to create borrow request' }, { status: 500 });
	}
}
