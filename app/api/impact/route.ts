import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserImpact } from '@/lib/impact';

// GET /api/impact - current user's sharing impact summary
export async function GET() {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const impact = await getUserImpact(session.user.id);
		return NextResponse.json(impact, { status: 200 });
	} catch (error) {
		console.error('Get impact error:', error);
		return NextResponse.json({ error: 'Failed to load impact' }, { status: 500 });
	}
}
