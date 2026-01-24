import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canUsersChat, getDirectConversationOtherUserId, getUserIdOrResponse } from '../_utils';

// GET /api/messages/threads/[id] - conversation details
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		const { id } = await params;
		const conversation = await prisma.conversation.findUnique({
			where: { id },
			include: {
				participants: {
					include: {
						user: {
							select: {
								id: true,
								name: true,
								image: true,
							},
						},
					},
				},
			},
		});

		if (!conversation) {
			return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
		}

		const isParticipant = conversation.participants.some(p => p.userId === userId);
		if (!isParticipant) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		const otherParticipants = conversation.participants
			.filter(p => p.userId !== userId)
			.map(p => p.user);

		const otherUserId =
			conversation.type === 'DIRECT'
				? await getDirectConversationOtherUserId(conversation.id, userId)
				: null;
		const canMessage =
			otherUserId && conversation.type === 'DIRECT' ? await canUsersChat(userId, otherUserId) : true;

		return NextResponse.json(
			{
				id: conversation.id,
				type: conversation.type,
				lastMessageAt: conversation.lastMessageAt,
				participants: otherParticipants,
				canMessage,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Get conversation error:', error);
		return NextResponse.json({ error: 'Failed to fetch conversation' }, { status: 500 });
	}
}
