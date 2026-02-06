import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdOrResponse } from '../threads/_utils';

// GET /api/messages/unread-count - Get total unread message count across all conversations
export async function GET() {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		// Get all conversations the user is part of with their read timestamps
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

		if (participants.length === 0) {
			return NextResponse.json({ unreadCount: 0 }, { status: 200 });
		}

		// Build a single query to count all unread messages across conversations
		// Using OR conditions for each conversation with its specific timestamp filter
		const unreadConditions = participants.map(p => {
			// Determine the effective cutoff time (later of lastReadAt and deletedAt)
			const cutoffs: Date[] = [];
			if (p.lastReadAt) cutoffs.push(p.lastReadAt);
			if (p.deletedAt) cutoffs.push(p.deletedAt);
			const effectiveCutoff = cutoffs.length > 0 ? new Date(Math.max(...cutoffs.map(d => d.getTime()))) : null;

			return {
				conversationId: p.conversationId,
				senderId: { not: userId },
				...(effectiveCutoff ? { createdAt: { gt: effectiveCutoff } } : {}),
			};
		});

		// Single aggregated query instead of N queries
		const totalUnread = await prisma.message.count({
			where: {
				OR: unreadConditions,
			},
		});

		return NextResponse.json({ unreadCount: totalUnread }, { status: 200 });
	} catch (error) {
		console.error('Get unread count error:', error);
		return NextResponse.json({ error: 'Failed to fetch unread count' }, { status: 500 });
	}
}
