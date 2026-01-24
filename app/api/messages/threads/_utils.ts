import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function getUserIdOrResponse() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) {
		return { userId: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
	}

	return { userId: session.user.id, response: null };
}

export async function getSharedCircleIds(userId: string, otherUserId: string): Promise<string[]> {
	const memberships = await prisma.circleMember.findMany({
		where: {
			userId: { in: [userId, otherUserId] },
			leftAt: null,
		},
		select: {
			userId: true,
			circleId: true,
		},
	});

	const circleCounts = memberships.reduce<Record<string, Set<string>>>((acc, membership) => {
		if (!acc[membership.circleId]) {
			acc[membership.circleId] = new Set();
		}
		acc[membership.circleId].add(membership.userId);
		return acc;
	}, {});

	return Object.entries(circleCounts)
		.filter(([, users]) => users.size >= 2)
		.map(([circleId]) => circleId);
}

export async function canUsersChat(userId: string, otherUserId: string): Promise<boolean> {
	const shared = await getSharedCircleIds(userId, otherUserId);
	return shared.length > 0;
}

export async function getDirectConversationOtherUserId(
	conversationId: string,
	userId: string,
): Promise<string | null> {
	const participants = await prisma.conversationParticipant.findMany({
		where: {
			conversationId,
			leftAt: null,
		},
		select: {
			userId: true,
		},
	});

	if (participants.length !== 2) {
		return null;
	}

	const other = participants.find(p => p.userId !== userId);
	return other?.userId || null;
}
