import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ItemRequestStatus, NotificationType } from '@prisma/client';
import { queueCircleNotification, queueBroadcast } from '@/lib/notify';

// GET/POST item requests with multi-circle (circleIds) and per-circle notify/broadcast
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
		const includeIgnored = req.nextUrl.searchParams.get('includeIgnored') === 'true';

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
			circles: { some: { circleId: string | { in: string[] } } };
			status?: ItemRequestStatus;
			requesterId?: string;
		} = {
			circles: {
				some: {
					circleId: circleId || { in: userCircleIds },
				},
			},
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
				actions: {
					where: { userId },
					select: { action: true },
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		// Map actions to boolean flags and optionally filter ignored
		const mapped = itemRequests.map(request => {
			const actionSet = new Set(request.actions.map(a => a.action));
			const { actions: _actions, ...rest } = request;
			return {
				...rest,
				circle: request.circles[0]?.circle ?? null,
				isIgnored: actionSet.has('IGNORED'),
				isResponded: actionSet.has('RESPONDED'),
			};
		});

		const response = includeIgnored ? mapped : mapped.filter(r => !r.isIgnored);

		return NextResponse.json(response, { status: 200 });
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
		const { title, description, circleIds, circleId, desiredFrom, desiredTo } = body;

		// Validate required fields
		if (!title || typeof title !== 'string' || title.trim().length === 0) {
			return NextResponse.json({ error: 'Title is required' }, { status: 400 });
		}

		const requestedCircleIds = Array.isArray(circleIds) ? circleIds : circleId ? [circleId] : [];
		if (!Array.isArray(requestedCircleIds) || requestedCircleIds.length === 0) {
			return NextResponse.json({ error: 'At least one circle is required' }, { status: 400 });
		}

		const uniqueCircleIds = [
			...new Set(requestedCircleIds.filter((id: unknown) => typeof id === 'string')),
		] as string[];
		if (uniqueCircleIds.length === 0) {
			return NextResponse.json({ error: 'At least one valid circle is required' }, { status: 400 });
		}

		// Verify user is a member of all selected circles
		const memberships = await prisma.circleMember.findMany({
			where: {
				userId,
				circleId: { in: uniqueCircleIds },
				leftAt: null,
			},
			select: { circleId: true },
		});

		const memberCircleIds = memberships.map(m => m.circleId);
		const invalidCircleIds = uniqueCircleIds.filter(id => !memberCircleIds.includes(id));
		if (invalidCircleIds.length > 0) {
			return NextResponse.json({ error: 'You are not a member of some selected circles' }, { status: 403 });
		}

		// Get circle names for notifications
		const circles = await prisma.circle.findMany({
			where: { id: { in: uniqueCircleIds } },
			select: { id: true, name: true },
		});
		const circleNameById = new Map(circles.map(circle => [circle.id, circle.name]));

		// Create the item request
		let itemRequest;
		try {
			itemRequest = await prisma.itemRequest.create({
				data: {
					title: title.trim(),
					description: description?.trim() || null,
					requesterId: userId,
					circles: {
						create: uniqueCircleIds.map(selectedCircleId => ({
							circleId: selectedCircleId,
						})),
					},
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
		} catch (dbError) {
			console.error('Database error creating item request:', dbError);
			// Check for specific Prisma errors
			if (dbError instanceof Error) {
				if (dbError.message.includes('Unique constraint')) {
					return NextResponse.json(
						{ error: 'An item request with this title already exists in one of the selected circles' },
						{ status: 409 },
					);
				}
				if (dbError.message.includes('Foreign key constraint')) {
					return NextResponse.json({ error: 'Invalid circle or user' }, { status: 400 });
				}
			}
			throw dbError; // Re-throw to be caught by outer catch
		}

		const response = {
			...itemRequest,
			circle: itemRequest.circles[0]!.circle,
		};

		for (const selectedCircleId of uniqueCircleIds) {
			queueCircleNotification({
				circleId: selectedCircleId,
				actorId: userId,
				type: NotificationType.ITEM_REQUEST_CREATED,
				entityId: itemRequest.id,
				title: 'New Item Request',
				body: `${session.user.name || 'Someone'} is looking for "${title}" in ${circleNameById.get(selectedCircleId) || 'your circle'}`,
				metadata: {
					itemRequestId: itemRequest.id,
					requesterId: userId,
					requesterName: session.user.name,
					circleIds: uniqueCircleIds,
					circleNames: circles.map(circle => circle.name),
				},
			});

			queueBroadcast(`circle-requests:${selectedCircleId}`, 'new_item_request', {
				id: response.id,
				title: response.title,
				description: response.description,
				status: response.status,
				desiredFrom: response.desiredFrom?.toISOString() || null,
				desiredTo: response.desiredTo?.toISOString() || null,
				createdAt: response.createdAt.toISOString(),
				requester: response.requester,
				circle: response.circle,
			});
		}

		return NextResponse.json(response, { status: 201 });
	} catch (error) {
		console.error('Create item request error:', error);

		// Provide more specific error messages
		if (error instanceof Error) {
			// Prisma errors
			if (error.message.includes('Unique constraint')) {
				return NextResponse.json(
					{ error: 'An item request with this title already exists in one of the selected circles' },
					{ status: 409 },
				);
			}
			if (error.message.includes('Foreign key constraint')) {
				return NextResponse.json(
					{ error: 'Invalid circle or user. Please refresh and try again.' },
					{ status: 400 },
				);
			}
			if (error.message.includes('Record to create not found')) {
				return NextResponse.json({ error: 'Circle not found. Please refresh and try again.' }, { status: 404 });
			}

			// Return the error message if it's informative
			return NextResponse.json(
				{
					error: error.message || 'Failed to create item request',
				},
				{ status: 500 },
			);
		}

		return NextResponse.json({ error: 'Failed to create item request. Please try again.' }, { status: 500 });
	}
}
