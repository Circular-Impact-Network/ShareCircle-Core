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

/**
 * Batch version of canUsersChat — 2 DB queries regardless of how many other users.
 * Returns a Map<otherUserId, canChat>.
 */
export async function canUsersChatBatch(userId: string, otherUserIds: string[]): Promise<Map<string, boolean>> {
	if (otherUserIds.length === 0) return new Map();

	const currentUserMemberships = await prisma.circleMember.findMany({
		where: { userId, leftAt: null },
		select: { circleId: true },
	});
	const currentUserCircleIds = currentUserMemberships.map(m => m.circleId);

	if (currentUserCircleIds.length === 0) {
		return new Map(otherUserIds.map(id => [id, false]));
	}

	const otherMemberships = await prisma.circleMember.findMany({
		where: { userId: { in: otherUserIds }, circleId: { in: currentUserCircleIds }, leftAt: null },
		select: { userId: true },
	});

	const usersWithSharedCircle = new Set(otherMemberships.map(m => m.userId));
	return new Map(otherUserIds.map(id => [id, usersWithSharedCircle.has(id)]));
}

export async function getDirectConversationOtherUserId(conversationId: string, userId: string): Promise<string | null> {
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
