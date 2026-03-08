import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPushPublicKey, isPushConfigured } from '@/lib/push';
import { prisma } from '@/lib/prisma';

type PushSubscriptionBody = {
	endpoint?: string;
	expirationTime?: number | null;
	keys?: {
		p256dh?: string;
		auth?: string;
	};
};

async function getAuthenticatedUserId() {
	const session = await getServerSession(authOptions);

	if (!session?.user?.id) {
		return null;
	}

	return session.user.id;
}

export async function GET() {
	try {
		const userId = await getAuthenticatedUserId();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const subscriptions = await prisma.pushSubscription.count({
			where: {
				userId,
				enabled: true,
			},
		});

		return NextResponse.json(
			{
				configured: isPushConfigured(),
				publicKey: getPushPublicKey(),
				subscriptions,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Failed to read push subscriptions:', error);
		return NextResponse.json({ error: 'Failed to read push subscriptions' }, { status: 500 });
	}
}

export async function POST(req: NextRequest) {
	try {
		const userId = await getAuthenticatedUserId();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		if (!isPushConfigured()) {
			return NextResponse.json({ error: 'Push notifications are not configured' }, { status: 503 });
		}

		const body = (await req.json()) as PushSubscriptionBody;
		const endpoint = body.endpoint?.trim();
		const p256dh = body.keys?.p256dh?.trim();
		const auth = body.keys?.auth?.trim();

		if (!endpoint || !p256dh || !auth) {
			return NextResponse.json({ error: 'Invalid push subscription payload' }, { status: 400 });
		}

		await prisma.pushSubscription.upsert({
			where: { endpoint },
			update: {
				userId,
				p256dh,
				auth,
				expirationTime: body.expirationTime ? new Date(body.expirationTime) : null,
				userAgent: req.headers.get('user-agent'),
				enabled: true,
			},
			create: {
				userId,
				endpoint,
				p256dh,
				auth,
				expirationTime: body.expirationTime ? new Date(body.expirationTime) : null,
				userAgent: req.headers.get('user-agent'),
				enabled: true,
			},
		});

		return NextResponse.json({ ok: true }, { status: 200 });
	} catch (error) {
		console.error('Failed to save push subscription:', error);
		return NextResponse.json({ error: 'Failed to save push subscription' }, { status: 500 });
	}
}

export async function DELETE(req: NextRequest) {
	try {
		const userId = await getAuthenticatedUserId();
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = (await req.json().catch(() => ({}))) as PushSubscriptionBody;
		const endpoint = body.endpoint?.trim();

		if (endpoint) {
			await prisma.pushSubscription.deleteMany({
				where: {
					userId,
					endpoint,
				},
			});
		}

		return NextResponse.json({ ok: true }, { status: 200 });
	} catch (error) {
		console.error('Failed to delete push subscription:', error);
		return NextResponse.json({ error: 'Failed to delete push subscription' }, { status: 500 });
	}
}
