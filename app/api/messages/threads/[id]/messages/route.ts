import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase';
import { AttachmentType } from '@prisma/client';
import { canUsersChat, getDirectConversationOtherUserId, getUserIdOrResponse } from '../../_utils';

const MAX_PAGE_SIZE = 50;

// GET /api/messages/threads/[id]/messages - list messages
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		const { id } = await params;
		const conversation = await prisma.conversation.findUnique({
			where: { id },
			select: {
				id: true,
				type: true,
			},
		});

		if (!conversation) {
			return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
		}

		const participant = await prisma.conversationParticipant.findFirst({
			where: {
				conversationId: id,
				userId,
			},
		});

		if (!participant) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		const cursor = req.nextUrl.searchParams.get('cursor');
		const search = req.nextUrl.searchParams.get('search')?.trim();
		const limitParam = req.nextUrl.searchParams.get('limit');
		const limit = Math.min(Number(limitParam) || 30, MAX_PAGE_SIZE);

		let cursorCreatedAt: Date | null = null;
		if (cursor) {
			const cursorMessage = await prisma.message.findUnique({
				where: { id: cursor },
				select: { createdAt: true },
			});
			cursorCreatedAt = cursorMessage?.createdAt || null;
		}

		const whereClause: {
			conversationId: string;
			createdAt?: { lt: Date };
			body?: { contains: string; mode: 'insensitive' };
		} = {
			conversationId: id,
		};

		if (cursorCreatedAt && !search) {
			whereClause.createdAt = { lt: cursorCreatedAt };
		}

		if (search) {
			whereClause.body = { contains: search, mode: 'insensitive' };
		}

		const messages = await prisma.message.findMany({
			where: whereClause,
			orderBy: { createdAt: 'desc' },
			take: limit,
			include: {
				sender: {
					select: {
						id: true,
						name: true,
						image: true,
					},
				},
				receipts: true,
				attachments: true,
			},
		});

		const messageIds = messages.map(message => message.id);
		if (messageIds.length > 0) {
			// Find receipts that will be updated (before updating)
			const undeliveredReceipts = await prisma.messageReceipt.findMany({
				where: {
					userId,
					messageId: { in: messageIds },
					deliveredAt: null,
				},
				select: {
					id: true,
					messageId: true,
					userId: true,
					readAt: true,
				},
			});

			const now = new Date();
			await prisma.messageReceipt.updateMany({
				where: {
					userId,
					messageId: { in: messageIds },
					deliveredAt: null,
				},
				data: {
					deliveredAt: now,
				},
			});

			// Broadcast delivery receipts to sender
			if (undeliveredReceipts.length > 0) {
				try {
					const channel = supabaseAdmin.channel(`messages:${id}`);
					for (const receipt of undeliveredReceipts) {
						await channel.send({
							type: 'broadcast',
							event: 'receipt_update',
							payload: {
								id: receipt.id,
								messageId: receipt.messageId,
								userId: receipt.userId,
								deliveredAt: now.toISOString(),
								readAt: receipt.readAt?.toISOString() || null,
							},
						});
					}
					await supabaseAdmin.removeChannel(channel);
				} catch (broadcastError) {
					console.error('Failed to broadcast delivery receipts:', broadcastError);
				}
			}
		}

		const orderedMessages = [...messages].reverse();
		const nextCursor = messages.length === limit ? messages[messages.length - 1]?.id : null;

		const otherUserId =
			conversation.type === 'DIRECT'
				? await getDirectConversationOtherUserId(conversation.id, userId)
				: null;
		const canMessage =
			otherUserId && conversation.type === 'DIRECT' ? await canUsersChat(userId, otherUserId) : true;

		return NextResponse.json(
			{
				messages: orderedMessages,
				nextCursor,
				canMessage,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Get messages error:', error);
		return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
	}
}

// POST /api/messages/threads/[id]/messages - send message
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		const { id } = await params;
		const body = await req.json();
		const messageBody = typeof body?.body === 'string' ? body.body.trim() : '';
		const clientId = typeof body?.clientId === 'string' ? body.clientId : null;
		const attachments =
			Array.isArray(body?.attachments)
				? body.attachments
						.filter((attachment: unknown) => {
							if (!attachment || typeof attachment !== 'object') return false;
							const candidate = attachment as { type?: unknown; url?: unknown };
							return candidate.type === 'IMAGE' && typeof candidate.url === 'string' && candidate.url.length > 0;
						})
						.map((attachment: { type: 'IMAGE'; url: string; path?: string }) => ({
							type: attachment.type,
							url: attachment.url,
							path: attachment.path,
						}))
				: [];

		if (!messageBody && attachments.length === 0) {
			return NextResponse.json({ error: 'Message body or attachment is required' }, { status: 400 });
		}

		const conversation = await prisma.conversation.findUnique({
			where: { id },
			include: {
				participants: {
					where: { leftAt: null },
					select: { userId: true },
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

		if (clientId) {
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

			if (attachments.length > 0) {
				await tx.messageAttachment.createMany({
					data: attachments.map(attachment => ({
						messageId: created.id,
						type: AttachmentType.IMAGE,
						url: attachment.url,
						metadata: attachment.path ? { path: attachment.path } : undefined,
					})),
				});
			}

			const createdWithAttachments = await tx.message.findUniqueOrThrow({
				where: { id: created.id },
				include: {
					sender: { select: { id: true, name: true, image: true } },
					attachments: true,
				},
			});

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

			return createdWithAttachments;
		});

		const receipts = await prisma.messageReceipt.findMany({
			where: { messageId: createdMessage.id },
		});

		// Broadcast the new message via Supabase realtime
		const messagePayload = {
			id: createdMessage.id,
			conversationId: createdMessage.conversationId,
			senderId: createdMessage.senderId,
			body: createdMessage.body,
			createdAt: createdMessage.createdAt.toISOString(),
			clientId: createdMessage.clientId,
			sender: createdMessage.sender,
			receipts,
			attachments: createdMessage.attachments,
		};

		try {
			// Broadcast to conversation channel (for users viewing this specific chat)
			const conversationChannel = supabaseAdmin.channel(`messages:${conversation.id}`);
			await conversationChannel.send({
				type: 'broadcast',
				event: 'new_message',
				payload: messagePayload,
			});
			await supabaseAdmin.removeChannel(conversationChannel);

			// Also broadcast to each recipient's personal channel (for users on chat list or elsewhere)
			for (const recipientId of recipientIds) {
				const userChannel = supabaseAdmin.channel(`user:${recipientId}:messages`);
				await userChannel.send({
					type: 'broadcast',
					event: 'new_message',
					payload: messagePayload,
				});
				await supabaseAdmin.removeChannel(userChannel);
			}
		} catch (broadcastError) {
			// Log but don't fail the request if broadcast fails
			console.error('Failed to broadcast message:', broadcastError);
		}

		return NextResponse.json(
			{
				...createdMessage,
				receipts,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error('Send message error:', error);
		return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
	}
}
