import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BorrowTransactionStatus, MemberRole, NotificationType } from '@prisma/client';
import { queueNotification } from '@/lib/notify';

// DELETE /api/circles/[id]/items/[itemId]
// Circle admin removes an item listing from their circle (does not delete the item).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: circleId, itemId } = await params;
		const userId = session.user.id;

		const { reason } = await req.json().catch(() => ({ reason: undefined }));

		// Verify caller is an active ADMIN of this circle
		const membership = await prisma.circleMember.findUnique({
			where: { circleId_userId: { circleId, userId } },
		});
		if (!membership || membership.leftAt || membership.role !== MemberRole.ADMIN) {
			return NextResponse.json({ error: 'Only circle admins can remove items' }, { status: 403 });
		}

		// Find the ItemCircle row
		const itemCircle = await prisma.itemCircle.findUnique({
			where: { itemId_circleId: { itemId, circleId } },
			include: { item: { select: { ownerId: true, name: true } } },
		});
		if (!itemCircle) {
			return NextResponse.json({ error: 'Item not found in this circle' }, { status: 404 });
		}


		// Block removal while the item is in an active borrow lifecycle
		const activeTransaction = await prisma.borrowTransaction.findFirst({
			where: {
				itemId,
				status: { notIn: [BorrowTransactionStatus.COMPLETED, BorrowTransactionStatus.CANCELLED] },
			},
			select: { id: true },
		});
		if (activeTransaction) {
			return NextResponse.json(
				{
					error: "This item is currently borrowed — it can't be removed from the circle until the borrow is completed or cancelled.",
				},
				{ status: 409 },
			);
		}

		// Remove item from this circle only
		await prisma.itemCircle.delete({
			where: { itemId_circleId: { itemId, circleId } },
		});

		// Notify item owner (skip if admin is removing their own item)
		const ownerId = itemCircle.item.ownerId;
		if (ownerId !== userId) {
			const circle = await prisma.circle.findUnique({ where: { id: circleId }, select: { name: true } });
			const circleName = circle?.name ?? 'a circle';
			const itemName = itemCircle.item.name;
			const body = reason
				? `Your item "${itemName}" was removed from ${circleName}. Reason: ${reason}`
				: `Your item "${itemName}" was removed from ${circleName} by the admin.`;

			queueNotification({
				userId: ownerId,
				type: NotificationType.ITEM_REMOVED_FROM_CIRCLE,
				entityId: itemId,
				title: 'Item removed from circle',
				body,
				metadata: { itemId, circleId, reason: reason ?? null },
			});
		}

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Admin item removal error:', error);
		return NextResponse.json({ error: 'Failed to remove item from circle' }, { status: 500 });
	}
}
