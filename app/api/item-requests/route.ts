import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ItemRequestStatus, NotificationType } from '@prisma/client';
import { notifyCircleMembers, broadcastItemRequest } from '@/lib/notifications';

// GET /api/item-requests - Get item requests for user's circles
export async function GET(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const circleId = req.nextUrl.searchParams.get('circleId');
		const status = req.nextUrl.searchParams.get('status') as ItemRequestStatus | null;
		const myRequests = req.nextUrl.searchParams.get('myRequests') === 'true';

		// Get circles the user is a member of
		const userCircles = await prisma.circleMember.findMany({
			where: {
				userId,
				leftAt: null,
			},
			select: {
				circleId: true,
			},
		});

		const userCircleIds = userCircles.map(m => m.circleId);

		// If circleId is specified, verify user is a member
		if (circleId && !userCircleIds.includes(circleId)) {
			return NextResponse.json({ error: 'You are not a member of this circle' }, { status: 403 });
		}

		// Build where clause
		const whereClause: {
			circleId: string | { in: string[] };
			status?: ItemRequestStatus;
			requesterId?: string;
		} = {
			circleId: circleId || { in: userCircleIds },
		};

		if (status) {
			whereClause.status = status;
		}

		if (myRequests) {
			whereClause.requesterId = userId;
		}

		const itemRequests = await prisma.itemRequest.findMany({
			where: whereClause,
			include: {
				requester: {
					select: {
						id: true,
						name: true,
						image: true,
					},
				},
				circle: {
					select: {
						id: true,
						name: true,
					},
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		return NextResponse.json(itemRequests, { status: 200 });
	} catch (error) {
		console.error('Get item requests error:', error);
		return NextResponse.json({ error: 'Failed to fetch item requests' }, { status: 500 });
	}
}

// POST /api/item-requests - Create a new item request
export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const body = await req.json();
		const { title, description, circleId, desiredFrom, desiredTo } = body;

		// Validate required fields
		if (!title || typeof title !== 'string' || title.trim().length === 0) {
			return NextResponse.json({ error: 'Title is required' }, { status: 400 });
		}

		if (!circleId) {
			return NextResponse.json({ error: 'Circle is required' }, { status: 400 });
		}

		// Verify user is a member of the circle
		const membership = await prisma.circleMember.findFirst({
			where: {
				userId,
				circleId,
				leftAt: null,
			},
		});

		if (!membership) {
			return NextResponse.json({ error: 'You are not a member of this circle' }, { status: 403 });
		}

		// Get circle name for notification
		const circle = await prisma.circle.findUnique({
			where: { id: circleId },
			select: { name: true },
		});

		// Create the item request
		const itemRequest = await prisma.itemRequest.create({
			data: {
				title: title.trim(),
				description: description?.trim() || null,
				requesterId: userId,
				circleId,
				desiredFrom: desiredFrom ? new Date(desiredFrom) : null,
				desiredTo: desiredTo ? new Date(desiredTo) : null,
				status: ItemRequestStatus.OPEN,
			},
			include: {
				requester: {
					select: {
						id: true,
						name: true,
						image: true,
					},
				},
				circle: {
					select: {
						id: true,
						name: true,
					},
				},
			},
		});

		// Notify circle members about the new item request
		await notifyCircleMembers({
			circleId,
			actorId: userId,
			type: NotificationType.ITEM_REQUEST_CREATED,
			entityId: itemRequest.id,
			title: 'New Item Request',
			body: `${session.user.name || 'Someone'} is looking for "${title}" in ${circle?.name || 'your circle'}`,
			metadata: {
				itemRequestId: itemRequest.id,
				requesterId: userId,
				requesterName: session.user.name,
				circleId,
				circleName: circle?.name,
			},
		});

		// Broadcast to circle channel for realtime updates
		await broadcastItemRequest({
			circleId,
			request: itemRequest,
		});

		return NextResponse.json(itemRequest, { status: 201 });
	} catch (error) {
		console.error('Create item request error:', error);
		return NextResponse.json({ error: 'Failed to create item request' }, { status: 500 });
	}
}
