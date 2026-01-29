import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdOrResponse } from '../threads/_utils';

// GET /api/messages/unread-count - Get total unread message count across all conversations
export async function GET() {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		// Get all conversations the user is part of
		const participants = await prisma.conversationParticipant.findMany({
			where: {
				userId,
				leftAt: null,
			},
			select: {
				conversationId: true,
				lastReadAt: true,
				deletedAt: true,
			},
		});

		// Count unread messages across all conversations
		let totalUnread = 0;

		for (const participant of participants) {
			const unreadCount = await prisma.message.count({
				where: {
					conversationId: participant.conversationId,
					senderId: { not: userId },
					// Only count messages after lastReadAt
					...(participant.lastReadAt
						? { createdAt: { gt: participant.lastReadAt } }
						: {}),
					// Only count messages after deletedAt if set
					...(participant.deletedAt
						? { createdAt: { gt: participant.deletedAt } }
						: {}),
				},
			});
			totalUnread += unreadCount;
		}

		return NextResponse.json({ unreadCount: totalUnread }, { status: 200 });
	} catch (error) {
		console.error('Get unread count error:', error);
		return NextResponse.json({ error: 'Failed to fetch unread count' }, { status: 500 });
	}
}
