import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase';
import { getUserIdOrResponse } from '../threads/_utils';

// POST /api/messages/delivered - mark message as delivered
export async function POST(req: NextRequest) {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		const body = await req.json();
		const messageId = typeof body?.messageId === 'string' ? body.messageId : null;

		if (!messageId) {
			return NextResponse.json({ error: 'Message ID is required' }, { status: 400 });
		}

		// Find the receipt for this user and message
		const receipt = await prisma.messageReceipt.findFirst({
			where: {
				messageId,
				userId,
				deliveredAt: null,
			},
			include: {
				message: {
					select: {
						conversationId: true,
					},
				},
			},
		});

		if (!receipt) {
			// Either already delivered or not a recipient
			return NextResponse.json({ success: true }, { status: 200 });
		}

		const now = new Date();
		await prisma.messageReceipt.update({
			where: { id: receipt.id },
			data: { deliveredAt: now },
		});

		// Broadcast the delivery receipt to the sender
		try {
			const channel = supabaseAdmin.channel(`messages:${receipt.message.conversationId}`);
			await channel.send({
				type: 'broadcast',
				event: 'receipt_update',
				payload: {
					id: receipt.id,
					messageId: receipt.messageId,
					userId: receipt.userId,
					deliveredAt: now.toISOString(),
					readAt: null,
				},
			});
			await supabaseAdmin.removeChannel(channel);
		} catch (broadcastError) {
			console.error('Failed to broadcast delivery receipt:', broadcastError);
		}

		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.error('Mark delivered error:', error);
		return NextResponse.json({ error: 'Failed to mark as delivered' }, { status: 500 });
	}
}
