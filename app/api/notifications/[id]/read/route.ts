import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH /api/notifications/[id]/read - Mark notification as read
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;

		// Special case: mark all as read
		if (id === 'all') {
			await prisma.notification.updateMany({
				where: {
					userId,
					status: 'UNREAD',
				},
				data: {
					status: 'READ',
					readAt: new Date(),
				},
			});

			return NextResponse.json({ message: 'All notifications marked as read' }, { status: 200 });
		}

		// Verify notification belongs to user
		const notification = await prisma.notification.findUnique({
			where: { id },
		});

		if (!notification) {
			return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
		}

		if (notification.userId !== userId) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		// Update notification
		const updatedNotification = await prisma.notification.update({
			where: { id },
			data: {
				status: 'READ',
				readAt: new Date(),
			},
		});

		return NextResponse.json(updatedNotification, { status: 200 });
	} catch (error) {
		console.error('Mark notification read error:', error);
		return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 });
	}
}
