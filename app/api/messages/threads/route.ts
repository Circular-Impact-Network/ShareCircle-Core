import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { canUsersChat, getUserIdOrResponse } from './_utils';

// GET /api/messages/threads - list conversations
export async function GET(req: NextRequest) {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		const search = req.nextUrl.searchParams.get('q')?.trim().toLowerCase();
		const showArchived = req.nextUrl.searchParams.get('archived') === 'true';

		const conversations = await prisma.conversation.findMany({
			where: {
				participants: {
					some: {
						userId,
						leftAt: null,
					},
				},
			},
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
				messages: {
					take: 1,
					orderBy: {
						createdAt: 'desc',
					},
					select: {
						id: true,
						body: true,
						senderId: true,
						createdAt: true,
						messageType: true,
					},
				},
			},
			orderBy: [
				{ lastMessageAt: 'desc' },
				{ updatedAt: 'desc' },
			],
		});

		const results = await Promise.all(
			conversations.map(async conversation => {
				const currentParticipant = conversation.participants.find(p => p.userId === userId);
				if (!currentParticipant) {
					return null;
				}

				if (
					currentParticipant.deletedAt &&
					conversation.lastMessageAt &&
					conversation.lastMessageAt <= currentParticipant.deletedAt
				) {
					return null;
				}

				if (!showArchived && currentParticipant.archivedAt) {
					return null;
				}

				const otherParticipants = conversation.participants
					.filter(p => p.userId !== userId)
					.map(p => p.user);

				const otherName = otherParticipants[0]?.name?.toLowerCase() || '';
				if (search && !otherName.includes(search)) {
					return null;
				}

				const lastMessage = conversation.messages[0] || null;
				const unreadCount = await prisma.message.count({
					where: {
						conversationId: conversation.id,
						senderId: { not: userId },
						...(currentParticipant.lastReadAt
							? { createdAt: { gt: currentParticipant.lastReadAt } }
							: {}),
					},
				});

				const canMessage =
					conversation.type === 'DIRECT' && otherParticipants[0]?.id
						? await canUsersChat(userId, otherParticipants[0].id)
						: true;

				return {
					id: conversation.id,
					type: conversation.type,
					lastMessageAt: conversation.lastMessageAt,
					lastMessage,
					participants: otherParticipants,
					unreadCount,
					pinnedAt: currentParticipant.pinnedAt,
					archivedAt: currentParticipant.archivedAt,
					mutedUntil: currentParticipant.mutedUntil,
					deletedAt: currentParticipant.deletedAt,
					lastReadAt: currentParticipant.lastReadAt,
					canMessage,
				};
			}),
		);

		return NextResponse.json(results.filter(Boolean), { status: 200 });
	} catch (error) {
		console.error('Get conversations error:', error);
		return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
	}
}

// POST /api/messages/threads - create or get direct conversation
export async function POST(req: NextRequest) {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		const body = await req.json();
		const { otherUserId } = body;

		if (!otherUserId || typeof otherUserId !== 'string') {
			return NextResponse.json({ error: 'otherUserId is required' }, { status: 400 });
		}

		if (otherUserId === userId) {
			return NextResponse.json({ error: 'Cannot start a chat with yourself' }, { status: 400 });
		}

		const otherUser = await prisma.user.findUnique({
			where: { id: otherUserId },
			select: { id: true, name: true, image: true },
		});

		if (!otherUser) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		const hasSharedCircle = await canUsersChat(userId, otherUserId);
		if (!hasSharedCircle) {
			return NextResponse.json(
				{ error: 'You can only chat with users who share a circle' },
				{ status: 403 },
			);
		}

		const existing = await prisma.conversation.findFirst({
			where: {
				type: 'DIRECT',
				participants: {
					every: {
						userId: { in: [userId, otherUserId] },
					},
					some: {
						userId,
					},
				},
			},
			include: {
				participants: true,
			},
		});

		if (existing && existing.participants.length === 2) {
			await prisma.conversationParticipant.updateMany({
				where: {
					conversationId: existing.id,
					userId,
				},
				data: {
					deletedAt: null,
				},
			});

			return NextResponse.json(
				{
					id: existing.id,
					type: existing.type,
					participants: [otherUser],
				},
				{ status: 200 },
			);
		}

		const conversation = await prisma.$transaction(async tx => {
			const created = await tx.conversation.create({
				data: {
					type: 'DIRECT',
					createdById: userId,
					participants: {
						createMany: {
							data: [
								{ userId },
								{ userId: otherUserId },
							],
						},
					},
				},
			});

			return created;
		});

		return NextResponse.json(
			{
				id: conversation.id,
				type: conversation.type,
				participants: [otherUser],
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error('Create conversation error:', error);
		return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
	}
}
