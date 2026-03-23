import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { runAfterNewChatMessagePersisted } from '@/lib/chat-message-side-effects';
import { prisma } from '@/lib/prisma';
import { canUsersChat, getDirectConversationOtherUserId, getUserIdOrResponse } from '../../_utils';

// POST /api/messages/threads/[id]/retry - retry failed send
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		const { id } = await params;
		const body = await req.json();
		const messageBody = typeof body?.body === 'string' ? body.body.trim() : '';
		const clientId = typeof body?.clientId === 'string' ? body.clientId : null;

		if (!messageBody || !clientId) {
			return NextResponse.json({ error: 'body and clientId are required' }, { status: 400 });
		}

		const existing = await prisma.message.findFirst({
			where: {
				senderId: userId,
				clientId,
			},
			include: {
				sender: { select: { id: true, name: true, image: true } },
				receipts: true,
				attachments: true,
			},
		});

		if (existing) {
			return NextResponse.json(existing, { status: 200 });
		}

		const conversation = await prisma.conversation.findUnique({
			where: { id },
			include: {
				participants: {
					where: { leftAt: null },
					select: { userId: true, mutedUntil: true },
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

		const otherUserId =
			conversation.type === 'DIRECT' ? await getDirectConversationOtherUserId(conversation.id, userId) : null;
		if (otherUserId && conversation.type === 'DIRECT') {
			const allowed = await canUsersChat(userId, otherUserId);
			if (!allowed) {
				return NextResponse.json(
					{ error: 'Chat disabled. You no longer share a circle with this user.' },
					{ status: 403 },
				);
			}
		}

		const recipientIds = conversation.participants.filter(p => p.userId !== userId).map(p => p.userId);
		const now = new Date();
		const notificationRecipientIds = conversation.participants
			.filter(
				participant =>
					participant.userId !== userId && (!participant.mutedUntil || participant.mutedUntil <= now),
			)
			.map(participant => participant.userId);

		const createdMessage = await prisma.$transaction(async tx => {
			const created = await tx.message.create({
				data: {
					conversationId: conversation.id,
					senderId: userId,
					body: messageBody,
					clientId,
				},
				include: {
					sender: { select: { id: true, name: true, image: true } },
					attachments: true,
				},
			});

			if (recipientIds.length > 0) {
				await tx.messageReceipt.createMany({
					data: recipientIds.map(recipientId => ({
						messageId: created.id,
						userId: recipientId,
					})),
				});
			}

			await tx.conversation.update({
				where: { id: conversation.id },
				data: { lastMessageAt: created.createdAt },
			});

			await tx.conversationParticipant.updateMany({
				where: {
					conversationId: conversation.id,
					userId: { in: recipientIds },
				},
				data: {
					deletedAt: null,
				},
			});

			return created;
		});

		const receipts = await prisma.messageReceipt.findMany({
			where: { messageId: createdMessage.id },
		});

		after(async () => {
			try {
				await runAfterNewChatMessagePersisted({
					conversationId: conversation.id,
					senderId: userId,
					recipientIds,
					notificationRecipientIds,
					createdMessage,
					receipts,
				});
			} catch (error) {
				console.error('Message side-effects failed:', error);
			}
		});

		return NextResponse.json(
			{
				...createdMessage,
				receipts,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error('Retry message error:', error);
		return NextResponse.json({ error: 'Failed to retry message' }, { status: 500 });
	}
}
