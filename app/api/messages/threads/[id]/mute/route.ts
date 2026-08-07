import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdOrResponse } from '../../_utils';
import { parseBody } from '@/lib/api-guards';
import { z } from 'zod';

// POST /api/messages/threads/[id]/mute - set mutedUntil
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		const { id } = await params;
		const parsed = await parseBody(
			req,
			z.object({
				mutedUntil: z.string().datetime().nullish(),
				// Bounded: an unbounded number here becomes a Date far outside what Postgres accepts.
				durationMinutes: z
					.number()
					.int()
					.positive()
					.max(60 * 24 * 365)
					.nullish(),
			}),
		);
		if (!parsed.ok) return parsed.response;
		const mutedUntil = parsed.data.mutedUntil ? new Date(parsed.data.mutedUntil) : null;
		const durationMinutes = parsed.data.durationMinutes ?? null;

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
