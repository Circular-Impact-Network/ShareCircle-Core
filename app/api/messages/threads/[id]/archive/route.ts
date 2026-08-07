import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserIdOrResponse } from '../../_utils';
import { parseBody } from '@/lib/api-guards';
import { z } from 'zod';

// POST /api/messages/threads/[id]/archive - archive/unarchive conversation
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const { userId, response } = await getUserIdOrResponse();
		if (!userId) return response!;

		const { id } = await params;
		const parsed = await parseBody(req, z.object({ archived: z.boolean() }));
		if (!parsed.ok) return parsed.response;
		const { archived } = parsed.data;

		await prisma.conversationParticipant.updateMany({
			where: {
				conversationId: id,
				userId,
			},
			data: {
				archivedAt: archived ? new Date() : null,
			},
		});

		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		console.error('Archive conversation error:', error);
		return NextResponse.json({ error: 'Failed to update archive' }, { status: 500 });
	}
}
