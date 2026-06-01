import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Scaffold — parallel dashboard aggregation lands in the next commit.
export async function GET() {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		return NextResponse.json({
			user: null,
			notifications: { items: [], unreadCount: 0 },
			unreadMessages: { unreadCount: 0 },
			pendingBorrowRequests: [],
			openItemRequests: [],
			circles: [],
			recentThreads: [],
		});
	} catch (error) {
		console.error('Home summary error:', error);
		return NextResponse.json({ error: 'Failed to fetch home summary' }, { status: 500 });
	}
}
