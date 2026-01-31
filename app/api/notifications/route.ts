import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Use string literals for notification types to avoid enum import issues during hot reload
const ALERT_TYPES = [
	'ITEM_REQUEST_CREATED',
	'ITEM_REQUEST_FULFILLED',
	'BORROW_REQUEST_APPROVED',
	'BORROW_REQUEST_DECLINED',
	'QUEUE_POSITION_UPDATED',
	'QUEUE_ITEM_READY',
	'RETURN_CONFIRMED',
	'NEW_MESSAGE',
] as const;

const REQUEST_TYPES = [
	'BORROW_REQUEST_RECEIVED',
	'RETURN_REQUESTED',
] as const;

// GET /api/notifications - Get user's notifications
export async function GET(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const tab = req.nextUrl.searchParams.get('tab'); // 'alerts' | 'requests' | null (all)
		const status = req.nextUrl.searchParams.get('status');
		const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);
		const offset = parseInt(req.nextUrl.searchParams.get('offset') || '0', 10);

		// Build where clause
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const whereClause: any = {
			userId,
		};

		if (tab === 'alerts') {
			whereClause.type = { in: [...ALERT_TYPES] };
		} else if (tab === 'requests') {
			whereClause.type = { in: [...REQUEST_TYPES] };
		}

		if (status) {
			whereClause.status = status;
		}

		// Get notifications with count
		const [notifications, total, unreadCount] = await Promise.all([
			prisma.notification.findMany({
				where: whereClause,
				orderBy: {
					createdAt: 'desc',
				},
				take: limit,
				skip: offset,
			}),
			prisma.notification.count({
				where: whereClause,
			}),
			prisma.notification.count({
				where: {
					userId,
					status: 'UNREAD',
					...(tab === 'alerts' ? { type: { in: [...ALERT_TYPES] } } : {}),
					...(tab === 'requests' ? { type: { in: [...REQUEST_TYPES] } } : {}),
				},
			}),
		]);

		// Get unread counts for both tabs
		const [alertsUnread, requestsUnread] = await Promise.all([
			prisma.notification.count({
				where: {
					userId,
					status: 'UNREAD',
					type: { in: [...ALERT_TYPES] },
				},
			}),
			prisma.notification.count({
				where: {
					userId,
					status: 'UNREAD',
					type: { in: [...REQUEST_TYPES] },
				},
			}),
		]);

		return NextResponse.json(
			{
				notifications,
				pagination: {
					total,
					limit,
					offset,
					hasMore: offset + notifications.length < total,
				},
				unreadCount,
				tabCounts: {
					alerts: alertsUnread,
					requests: requestsUnread,
				},
			},
			{ status: 200 }
		);
	} catch (error) {
		console.error('Get notifications error:', error);
		return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
	}
}

// DELETE /api/notifications - Clear all notifications (or by type)
export async function DELETE(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const tab = req.nextUrl.searchParams.get('tab'); // 'alerts' | 'requests' | null (all)

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const whereClause: any = {
			userId,
		};

		if (tab === 'alerts') {
			whereClause.type = { in: [...ALERT_TYPES] };
		} else if (tab === 'requests') {
			whereClause.type = { in: [...REQUEST_TYPES] };
		}

		await prisma.notification.deleteMany({
			where: whereClause,
		});

		return NextResponse.json({ message: 'Notifications cleared' }, { status: 200 });
	} catch (error) {
		console.error('Clear notifications error:', error);
		return NextResponse.json({ error: 'Failed to clear notifications' }, { status: 500 });
	}
}
