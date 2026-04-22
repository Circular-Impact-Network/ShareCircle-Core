import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdOrResponse } from '../../_utils';

// POST /api/messages/threads/[id]/mute - set mutedUntil
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		const { id } = await params;
		const body = await req.json();
		const mutedUntil = body?.mutedUntil && typeof body.mutedUntil === 'string' ? new Date(body.mutedUntil) : null;
		const durationMinutes = typeof body?.durationMinutes === 'number' ? body.durationMinutes : null;

		let nextMutedUntil: Date | null = null;
		if (mutedUntil && !Number.isNaN(mutedUntil.getTime())) {
			nextMutedUntil = mutedUntil;
		} else if (durationMinutes && durationMinutes > 0) {
			nextMutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
		}

		await prisma.conversationParticipant.updateMany({
			where: {
				conversationId: id,
				userId,
			},
			data: {
				mutedUntil: nextMutedUntil,
			},
		});

		return NextResponse.json({ success: true, mutedUntil: nextMutedUntil }, { status: 200 });
	} catch (error) {
		console.error('Mute conversation error:', error);
		return NextResponse.json({ error: 'Failed to update mute' }, { status: 500 });
	}
}
