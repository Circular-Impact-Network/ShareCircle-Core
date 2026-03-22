import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isPushConfigured, sendPushToUser } from '@/lib/push';
import { prisma } from '@/lib/prisma';

export async function POST() {
	try {
		const session = await getServerSession(authOptions);
		const userId = session?.user?.id;
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		if (!isPushConfigured()) {
			return NextResponse.json({ error: 'Push notifications are not configured' }, { status: 503 });
		}

		const count = await prisma.pushSubscription.count({
			where: { userId, enabled: true },
		});

		if (count === 0) {
			return NextResponse.json(
				{ error: 'No push subscription on file for this account. Enable push on this device first.' },
				{ status: 400 },
			);
		}

		await sendPushToUser(
			userId,
			{
				title: 'ShareCircle test',
				body: 'If you see this, web push delivery is working.',
				url: '/settings',
				tag: 'PUSH_TEST',
				data: { purpose: 'test' },
			},
			{ purpose: 'test' },
		);

		const recent = await prisma.pushSendAttempt.findMany({
			where: { userId, purpose: 'test' },
			orderBy: { createdAt: 'desc' },
			take: Math.min(count, 5),
			select: {
				success: true,
				statusCode: true,
				endpointHost: true,
				errorMessage: true,
				createdAt: true,
			},
		});

		return NextResponse.json(
			{
				ok: true,
				message: 'Test push sent to your registered subscription(s). Check the device tray and the debug table below.',
				attempts: recent.map(a => ({
					...a,
					createdAt: a.createdAt.toISOString(),
				})),
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Push test error:', error);
		return NextResponse.json({ error: 'Failed to send test push' }, { status: 500 });
	}
}
