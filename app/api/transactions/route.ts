import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BorrowTransactionStatus } from '@prisma/client';
import { getSignedUrl } from '@/lib/supabase';

// GET /api/transactions - Get user's borrow transactions (as borrower or owner)
export async function GET(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const role = req.nextUrl.searchParams.get('role'); // 'borrower' | 'owner' | null (all)
		const status = req.nextUrl.searchParams.get('status') as BorrowTransactionStatus | null;
		const itemId = req.nextUrl.searchParams.get('itemId');

		// Build where clause
		const whereClause: {
			borrowerId?: string;
			ownerId?: string;
			OR?: Array<{ borrowerId: string } | { ownerId: string }>;
			status?: BorrowTransactionStatus;
			itemId?: string;
		} = {};

		if (role === 'borrower') {
			whereClause.borrowerId = userId;
		} else if (role === 'owner') {
			whereClause.ownerId = userId;
		} else {
			whereClause.OR = [{ borrowerId: userId }, { ownerId: userId }];
		}

		if (status) {
			whereClause.status = status;
		}

		if (itemId) {
			whereClause.itemId = itemId;
		}

		const transactions = await prisma.borrowTransaction.findMany({
			where: whereClause,
			include: {
				item: {
					select: {
						id: true,
						name: true,
						imagePath: true,
					},
				},
				borrower: {
					select: {
						id: true,
						name: true,
						image: true,
					},
				},
				owner: {
					select: {
						id: true,
						name: true,
						image: true,
					},
				},
				borrowRequest: {
					select: {
						id: true,
						message: true,
						desiredFrom: true,
						desiredTo: true,
					},
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		// Add signed URLs
		const transactionsWithUrls = await Promise.all(
			transactions.map(async transaction => ({
				...transaction,
				item: {
					...transaction.item,
					imageUrl: await getSignedUrl(transaction.item.imagePath, 'items'),
				},
			}))
		);

		return NextResponse.json(transactionsWithUrls, { status: 200 });
	} catch (error) {
		console.error('Get transactions error:', error);
		return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
	}
}
