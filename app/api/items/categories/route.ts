import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { unstable_cache } from 'next/cache';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserCircleIds } from '@/app/api/_utils';

// Distinct categories visible to a given set of circles, cached for 5 minutes.
// Cache key is the sorted circleIds, so users in the same set of circles share cache.
const getCategoriesForCircles = unstable_cache(
	async (circleIds: string[]): Promise<string[]> => {
		if (circleIds.length === 0) return [];
		const rows = await prisma.$queryRaw<{ category: string }[]>`
			SELECT DISTINCT unnest(categories) AS category
			FROM items
			WHERE archived_at IS NULL
			  AND is_available = true
			  AND id IN (
				SELECT item_id FROM item_circles WHERE circle_id = ANY(${circleIds}::text[])
			  )
			ORDER BY category
		`;
		return rows.map(r => r.category).filter(Boolean);
	},
	['items-categories-by-circles'],
	{ revalidate: 300, tags: ['items-categories'] },
);

// GET /api/items/categories - Get distinct categories from items visible to user
export async function GET() {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userCircleIds = await getUserCircleIds(session.user.id);
		const sortedCircleIds = [...userCircleIds].sort();
		const categories = await getCategoriesForCircles(sortedCircleIds);

		return NextResponse.json(categories, { status: 200 });
	} catch (error) {
		console.error('Get item categories error:', error);
		return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
	}
}
