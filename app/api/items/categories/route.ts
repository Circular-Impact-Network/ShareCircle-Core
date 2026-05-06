import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserCircleIds } from '@/app/api/_utils';

// GET /api/items/categories - Get distinct categories from items visible to user
export async function GET() {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;

		const userCircleIds = await getUserCircleIds(userId);

		// Query distinct categories from items in the user's circles
		const items = await prisma.item.findMany({
			where: {
				circles: { some: { circleId: { in: userCircleIds } } },
				isAvailable: true,
				archivedAt: null,
			},
			select: { categories: true },
		});

		const categories = [...new Set(items.flatMap(i => i.categories))].sort();

		return NextResponse.json(categories, { status: 200 });
	} catch (error) {
		console.error('Get item categories error:', error);
		return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
	}
}
