import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdOrResponse } from '../../_utils';

// PATCH /api/messages/threads/[id]/delete - soft delete conversation for user
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		const { id } = await params;
		await prisma.conversationParticipant.updateMany({
			where: {
				conversationId: id,
				userId,
			},
			data: {
				deletedAt: new Date(),
			},
		});

		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.error('Delete conversation error:', error);
		return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
	}
}
