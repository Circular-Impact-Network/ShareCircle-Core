import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ItemRequestStatus, NotificationType } from '@prisma/client';
import { queueNotification } from '@/lib/notify';

// GET/PATCH with circles relation and fulfilledBy in request circle
// GET /api/item-requests/[id] - Get a single item request
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;

		const itemRequest = await prisma.itemRequest.findUnique({
			where: { id },
			include: {
				requester: {
					select: {
						id: true,
						name: true,
						image: true,
					},
				},
				circles: {
					include: {
						circle: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
		});

		if (!itemRequest) {
			return NextResponse.json({ error: 'Item request not found' }, { status: 404 });
		}

		// Verify user is a member of at least one request circle
		const requestCircleIds = itemRequest.circles.map(entry => entry.circleId);
		const membership = await prisma.circleMember.findFirst({
			where: {
				userId,
				circleId: { in: requestCircleIds },
				leftAt: null,
			},
		});

		if (!membership) {
			return NextResponse.json({ error: 'You are not a member of this circle' }, { status: 403 });
		}

		return NextResponse.json(
			{
				...itemRequest,
				circle: itemRequest.circles[0]?.circle ?? null,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Get item request error:', error);
		return NextResponse.json({ error: 'Failed to fetch item request' }, { status: 500 });
	}
}

// PATCH /api/item-requests/[id] - Update item request (fulfill/cancel)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;
		const body = await req.json();
		const { status, fulfilledBy } = body;

		const itemRequest = await prisma.itemRequest.findUnique({
			where: { id },
			include: {
				requester: {
					select: {
						id: true,
						name: true,
					},
				},
				circles: {
					include: {
						circle: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
		});

		if (!itemRequest) {
			return NextResponse.json({ error: 'Item request not found' }, { status: 404 });
		}

		// Verify user is a member of at least one request circle
		const requestCircleIds = itemRequest.circles.map(entry => entry.circleId);
		const membership = await prisma.circleMember.findFirst({
			where: {
				userId,
				circleId: { in: requestCircleIds },
				leftAt: null,
			},
		});

		if (!membership) {
			return NextResponse.json({ error: 'You are not a member of this circle' }, { status: 403 });
		}

		// Only the requester can cancel their own request
		if (status === ItemRequestStatus.CANCELLED && itemRequest.requesterId !== userId) {
			return NextResponse.json({ error: 'Only the requester can cancel this request' }, { status: 403 });
		}

		/**
		 * `status` arrived straight from the body and was assigned without ever being checked
		 * against the enum, so any circle member could close, re-open, or falsely mark as
		 * fulfilled a request belonging to someone else — and re-fire ITEM_REQUEST_FULFILLED on
		 * every call. Only CANCELLED was restricted, to the requester.
		 */
		if (status !== undefined && !Object.values(ItemRequestStatus).includes(status)) {
			return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
		}

		// Terminal states are terminal: nothing reopens a finished request.
		if (status !== undefined && itemRequest.status !== ItemRequestStatus.OPEN) {
			return NextResponse.json({ error: 'This request has already been closed' }, { status: 409 });
		}

		// Marking something fulfilled is the requester's call, not any member's.
		if (status === ItemRequestStatus.FULFILLED && itemRequest.requesterId !== userId) {
			return NextResponse.json({ error: 'Only the requester can mark this request fulfilled' }, { status: 403 });
		}

		// Update the item request
		const updateData: { status?: ItemRequestStatus; fulfilledBy?: string } = {};

		if (status) {
			updateData.status = status;
		}

		if (fulfilledBy && status === ItemRequestStatus.FULFILLED) {
			// Verify the item exists and belongs to one of the request circles
			const item = await prisma.item.findFirst({
				where: {
					id: fulfilledBy,
					circles: {
						some: {
							circleId: { in: requestCircleIds },
						},
					},
				},
			});

			if (!item) {
				return NextResponse.json({ error: 'Item not found in this circle' }, { status: 404 });
			}

			updateData.fulfilledBy = fulfilledBy;
		}

		const updatedRequest = await prisma.itemRequest.update({
			where: { id },
			data: updateData,
			include: {
				requester: {
					select: {
						id: true,
						name: true,
						image: true,
					},
				},
				circles: {
					include: {
						circle: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
		});

		if (status === ItemRequestStatus.FULFILLED && itemRequest.requesterId !== userId) {
			queueNotification({
				userId: itemRequest.requesterId,
				type: NotificationType.ITEM_REQUEST_FULFILLED,
				entityId: itemRequest.id,
				title: 'Item Request Fulfilled',
				body: `Your request for "${itemRequest.title}" has been fulfilled!`,
				metadata: {
					itemRequestId: itemRequest.id,
					itemId: fulfilledBy,
					circleName: itemRequest.circles[0]?.circle.name || 'your circle',
				},
			});
		}

		return NextResponse.json(
			{
				...updatedRequest,
				circle: updatedRequest.circles[0]?.circle ?? null,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Update item request error:', error);
		return NextResponse.json({ error: 'Failed to update item request' }, { status: 500 });
	}
}
