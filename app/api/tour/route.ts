import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/api-guards';

/**
 * Whether this account has already been shown the guided tour.
 *
 * Stored per account rather than per browser so it does not restart every time someone signs in on
 * a new device — a returning user meeting the introductory tour again reads as the app having
 * forgotten them.
 */

export async function GET() {
	const guard = await requireUser();
	if (!guard.ok) {
		return guard.response;
	}

	try {
		const user = await prisma.user.findUnique({
			where: { id: guard.data.userId },
			select: { tour_completed_at: true },
		});

		return NextResponse.json({ completed: Boolean(user?.tour_completed_at) }, { status: 200 });
	} catch (error) {
		console.error('Failed to read tour state:', error);
		// Reported as completed on failure: showing an unexpected tour to an established user is a
		// worse outcome than a new user missing it and replaying it from Settings.
		return NextResponse.json({ completed: true }, { status: 200 });
	}
}

export async function POST() {
	const guard = await requireUser();
	if (!guard.ok) {
		return guard.response;
	}

	try {
		await prisma.user.update({
			where: { id: guard.data.userId },
			data: { tour_completed_at: new Date() },
		});

		return NextResponse.json({ completed: true }, { status: 200 });
	} catch (error) {
		console.error('Failed to record tour completion:', error);
		return NextResponse.json({ error: 'Failed to record tour completion' }, { status: 500 });
	}
}
