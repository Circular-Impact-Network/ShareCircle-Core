import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BorrowQueueStatus } from '@prisma/client';
import { getSignedUrl } from '@/lib/supabase';

// GET /api/borrow-queue - Get queue entries for a user or item
export async function GET(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const itemId = req.nextUrl.searchParams.get('itemId');
		const myEntries = req.nextUrl.searchParams.get('myEntries') === 'true';

		// Build where clause
		const whereClause: {
			itemId?: string;
			requesterId?: string;
			status?: { in: BorrowQueueStatus[] };
		} = {
			status: { in: [BorrowQueueStatus.WAITING, BorrowQueueStatus.READY] },
		};

		if (itemId) {
			whereClause.itemId = itemId;
		}

		if (myEntries) {
			whereClause.requesterId = userId;
		}

		const queueEntries = await prisma.borrowQueue.findMany({
			where: whereClause,
			include: {
				item: {
					select: {
						id: true,
						name: true,
						imagePath: true,
						ownerId: true,
						owner: {
							select: {
								id: true,
								name: true,
								image: true,
							},
						},
					},
				},
				requester: {
					select: {
						id: true,
						name: true,
						image: true,
					},
				},
			},
			orderBy: [{ itemId: 'asc' }, { position: 'asc' }],
		});

		// Add signed URLs for item images
		const entriesWithUrls = await Promise.all(
			queueEntries.map(async entry => ({
				...entry,
				item: {
					...entry.item,
					imageUrl: await getSignedUrl(entry.item.imagePath, 'items'),
				},
			})),
		);

		return NextResponse.json(entriesWithUrls, { status: 200 });
	} catch (error) {
		console.error('Get queue entries error:', error);
		return NextResponse.json({ error: 'Failed to fetch queue entries' }, { status: 500 });
	}
}
