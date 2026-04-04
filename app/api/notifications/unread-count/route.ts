import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET /api/notifications/unread-count - Get unread notification count
export async function GET(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const unreadCount = await prisma.notification.count({
			where: {
				userId: session.user.id,
				status: 'UNREAD',
			},
		});

		return NextResponse.json({ unreadCount });
	} catch (error) {
		console.error('Error in GET /api/notifications/unread-count:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
