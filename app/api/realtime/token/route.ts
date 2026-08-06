import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { mintRealtimeToken } from '@/lib/realtime-auth';

/**
 * Issues the caller's own Realtime token. The session is the only input — a client cannot ask for
 * a token for anybody else, which is what keeps the private-channel policies meaningful.
 */
export async function GET() {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { token, expiresAt } = await mintRealtimeToken(session.user.id);

		return NextResponse.json(
			{ token, expiresAt },
			// Never cached: it is a bearer credential scoped to one user.
			{ status: 200, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
		);
	} catch (error) {
		console.error('Realtime token error:', error);
		return NextResponse.json({ error: 'Failed to issue realtime token' }, { status: 500 });
	}
}
