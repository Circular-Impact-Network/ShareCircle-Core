import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserCircleIds } from '@/app/api/_utils';
import { BorrowRequestStatus, BorrowQueueStatus, NotificationType } from '@prisma/client';
import { z } from 'zod';

const createBorrowRequestSchema = z.object({
	itemId: z.string().min(1, 'Item ID is required'),
	message: z.string().max(500, 'Message must be 500 characters or fewer').optional(),
	desiredFrom: z.string().min(1, 'Start date is required'),
	desiredTo: z.string().min(1, 'End date is required'),
	joinQueue: z.boolean().optional().default(false),
});
import { queueNotification } from '@/lib/notify';
import { getSignedUrl, getSignedUrls } from '@/lib/supabase';

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

		// Default pagination: cap to 50 records, opt-in to larger limits via ?limit=.
		const rawLimit = Number(req.nextUrl.searchParams.get('limit') ?? '50');
		const take = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
		const cursor = req.nextUrl.searchParams.get('cursor');

		const borrowRequests = await prisma.borrowRequest.findMany({
			where: whereClause,
			take: take + 1,
			...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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

		const hasMore = borrowRequests.length > take;
		const page = hasMore ? borrowRequests.slice(0, take) : borrowRequests;

		// Add signed URLs for item images (batched within bucket).
		const itemImagePaths = page.map(r => r.item.imagePath).filter(Boolean);
		const itemUrlMap = itemImagePaths.length
			? await getSignedUrls(itemImagePaths, 'items').catch(() => new Map<string, string>())
			: new Map<string, string>();

		const requestsWithUrls = page.map(request => ({
			...request,
			item: {
				...request.item,
				imageUrl: itemUrlMap.get(request.item.imagePath) ?? '',
			},
		}));

		// Backwards-compatible: callers passing no ?limit get the flat array; paginated callers
		// can opt-in via Accept-header convention. To stay safe with existing clients we always
		// return the bare array here and document cursor via response header.
		const response = NextResponse.json(requestsWithUrls, { status: 200 });
		if (hasMore) {
			response.headers.set('x-next-cursor', page[page.length - 1]?.id ?? '');
		}
		return response;
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
		const parsed = createBorrowRequestSchema.safeParse(await req.json());
		if (!parsed.success) {
			return NextResponse.json(
				{ error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
				{ status: 400 },
			);
		}
		const { itemId, message, desiredFrom, desiredTo, joinQueue } = parsed.data;

		// Fetch item and user circles in parallel (independent queries)
		const [item, userCircleIds] = await Promise.all([
			prisma.item.findUnique({
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
			}),
			getUserCircleIds(userId),
		]);

		if (!item) {
			return NextResponse.json({ error: 'Item not found' }, { status: 404 });
		}

		// User cannot request their own item
		if (item.ownerId === userId) {
			return NextResponse.json({ error: 'You cannot borrow your own item' }, { status: 400 });
		}

		// Verify user is in at least one circle where the item is shared
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
			// Check queue status in parallel (both need only itemId)
			const [existingQueueEntry, lastQueueEntry] = await Promise.all([
				prisma.borrowQueue.findFirst({
					where: {
						itemId,
						requesterId: userId,
						status: BorrowQueueStatus.WAITING,
					},
				}),
				prisma.borrowQueue.findFirst({
					where: {
						itemId,
						status: BorrowQueueStatus.WAITING,
					},
					orderBy: {
						position: 'desc',
					},
				}),
			]);

			if (existingQueueEntry) {
				return NextResponse.json({ error: 'You are already in the queue for this item' }, { status: 400 });
			}

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

			queueNotification({
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
							imageUrl: await getSignedUrl(queueEntry.item.imagePath, 'items').catch(() => ''),
						},
					},
				},
				{ status: 201 },
			);
		}

		// If item is not available and user didn't opt to join queue
		if (!item.isAvailable && !joinQueue) {
			return NextResponse.json(
				{ error: 'Item is not available. You can join the queue instead.' },
				{ status: 400 },
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

		queueNotification({
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
						imageUrl: await getSignedUrl(borrowRequest.item.imagePath, 'items').catch(() => ''),
					},
				},
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error('Create borrow request error:', error);
		return NextResponse.json({ error: 'Failed to create borrow request' }, { status: 500 });
	}
}
