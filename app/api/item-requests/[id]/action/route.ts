import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// POST /api/item-requests/[id]/action - Create an action (IGNORED or RESPONDED) on an item request
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;
		const body = await req.json();
		const { action } = body;

		if (!action || !['IGNORED', 'RESPONDED'].includes(action)) {
			return NextResponse.json({ error: 'Invalid action. Must be IGNORED or RESPONDED' }, { status: 400 });
		}

		// Verify item request exists
		const itemRequest = await prisma.itemRequest.findUnique({ where: { id } });
		if (!itemRequest) {
			return NextResponse.json({ error: 'Item request not found' }, { status: 404 });
		}

		// Upsert the action
		const result = await prisma.itemRequestAction.upsert({
			where: {
				userId_itemRequestId_action: { userId, itemRequestId: id, action },
			},
			update: { createdAt: new Date() },
			create: { userId, itemRequestId: id, action },
		});

		return NextResponse.json(result, { status: 200 });
	} catch (error) {
		console.error('Item request action error:', error);
		return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
	}
}

// DELETE /api/item-requests/[id]/action - Remove an action (un-ignore)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;
		const action = req.nextUrl.searchParams.get('action') || 'IGNORED';

		await prisma.itemRequestAction.deleteMany({
			where: { userId, itemRequestId: id, action },
		});

		return NextResponse.json({ message: 'Action removed' }, { status: 200 });
	} catch (error) {
		console.error('Remove item request action error:', error);
		return NextResponse.json({ error: 'Failed to remove action' }, { status: 500 });
	}
}
