import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdOrResponse } from '../../_utils';

// PATCH /api/messages/threads/[id]/pin - pin/unpin conversation
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		const { id } = await params;
		const body = await req.json();
		const pinned = Boolean(body?.pinned);

		await prisma.conversationParticipant.updateMany({
			where: {
				conversationId: id,
				userId,
			},
			data: {
				pinnedAt: pinned ? new Date() : null,
			},
		});

		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.error('Pin conversation error:', error);
		return NextResponse.json({ error: 'Failed to update pin' }, { status: 500 });
	}
}
