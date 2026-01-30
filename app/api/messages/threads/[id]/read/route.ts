import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase';
import { getUserIdOrResponse } from '../../_utils';

// POST /api/messages/threads/[id]/read - mark read
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		const { id: conversationId } = await params;
		const participant = await prisma.conversationParticipant.findFirst({
			where: {
				conversationId,
				userId,
			},
		});

		if (!participant) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		// Find receipts that will be updated (before updating)
		const unreadReceipts = await prisma.messageReceipt.findMany({
			where: {
				userId,
				message: {
					conversationId,
				},
				readAt: null,
			},
			select: {
				id: true,
				messageId: true,
				userId: true,
			},
		});

		const now = new Date();
		await prisma.$transaction([
			prisma.conversationParticipant.updateMany({
				where: {
					conversationId,
					userId,
				},
				data: {
					lastReadAt: now,
				},
			}),
			prisma.messageReceipt.updateMany({
				where: {
					userId,
					message: {
						conversationId,
					},
					readAt: null,
				},
				data: {
					readAt: now,
					deliveredAt: now,
				},
			}),
		]);

		// Broadcast receipt updates to other participants
		if (unreadReceipts.length > 0) {
			try {
				const channel = supabaseAdmin.channel(`messages:${conversationId}`);
				for (const receipt of unreadReceipts) {
					await channel.send({
						type: 'broadcast',
						event: 'receipt_update',
						payload: {
							id: receipt.id,
							messageId: receipt.messageId,
							userId: receipt.userId,
							deliveredAt: now.toISOString(),
							readAt: now.toISOString(),
						},
					});
				}
				await supabaseAdmin.removeChannel(channel);
			} catch (broadcastError) {
				console.error('Failed to broadcast receipt updates:', broadcastError);
			}
		}

		// Broadcast to user's channel to update unread count in sidebar
		try {
			const userChannel = supabaseAdmin.channel(`user:${userId}:messages`);
			await userChannel.send({
				type: 'broadcast',
				event: 'messages_read',
				payload: {
					conversationId,
					readCount: unreadReceipts.length,
				},
			});
			await supabaseAdmin.removeChannel(userChannel);
		} catch (broadcastError) {
			console.error('Failed to broadcast messages read event:', broadcastError);
		}

		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.error('Read conversation error:', error);
		return NextResponse.json({ error: 'Failed to mark as read' }, { status: 500 });
	}
}
