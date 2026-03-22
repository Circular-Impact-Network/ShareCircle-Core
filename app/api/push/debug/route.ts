import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { NotificationType } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { isPushConfigured } from '@/lib/push';
import { prisma } from '@/lib/prisma';
import { buildEffectiveByType, ensureNotificationPreferences } from '@/lib/notification-preferences';

const RECENT_LIMIT = 25;

function endpointHost(endpoint: string): string {
	try {
		return new URL(endpoint).hostname;
	} catch {
		return 'invalid';
	}
}

export async function GET() {
	try {
		const session = await getServerSession(authOptions);
		const userId = session?.user?.id;
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const configured = isPushConfigured();

		const subscriptions = await prisma.pushSubscription.findMany({
			where: { userId, enabled: true },
			select: {
				id: true,
				endpoint: true,
				userAgent: true,
				updatedAt: true,
			},
			orderBy: { updatedAt: 'desc' },
		});

		const recentAttempts = await prisma.pushSendAttempt.findMany({
			where: { userId },
			orderBy: { createdAt: 'desc' },
			take: RECENT_LIMIT,
			select: {
				id: true,
				endpointHost: true,
				success: true,
				statusCode: true,
				errorMessage: true,
				errorBody: true,
				payloadTag: true,
				purpose: true,
				createdAt: true,
				pushSubscriptionId: true,
			},
		});

		const prefRow = await ensureNotificationPreferences(userId);
		const allTypes = Object.values(NotificationType) as NotificationType[];
		const effectiveChannelsByType = buildEffectiveByType(prefRow, allTypes);

		const last = recentAttempts[0];
		let computedStatus: string;
		if (!configured) {
			computedStatus = 'push_not_configured';
		} else if (subscriptions.length === 0) {
			computedStatus = 'no_subscription';
		} else if (!last) {
			computedStatus = 'no_send_attempts_yet';
		} else if (last.success) {
			computedStatus = 'last_send_succeeded';
		} else {
			computedStatus = 'last_send_failed';
		}

		return NextResponse.json(
			{
				configured,
				computedStatus,
				subscriptions: subscriptions.map(s => ({
					id: s.id,
					endpoint: s.endpoint,
					endpointHost: endpointHost(s.endpoint),
					userAgent: s.userAgent,
					updatedAt: s.updatedAt.toISOString(),
				})),
				recentAttempts: recentAttempts.map(a => ({
					...a,
					createdAt: a.createdAt.toISOString(),
				})),
				lastAttemptSummary: last
					? {
							success: last.success,
							statusCode: last.statusCode,
							endpointHost: last.endpointHost,
							errorMessage: last.errorMessage,
							purpose: last.purpose,
							payloadTag: last.payloadTag,
							createdAt: last.createdAt.toISOString(),
						}
					: null,
				effectiveChannelsByType,
				messagePushHint:
					!effectiveChannelsByType.NEW_MESSAGE?.push && effectiveChannelsByType.NEW_MESSAGE?.inApp
						? 'Chat messages are allowed in-app but push is off for NEW_MESSAGE in your notification preferences. Test push ignores these toggles.'
						: !effectiveChannelsByType.NEW_MESSAGE?.push
							? 'Push for new messages (NEW_MESSAGE) is off in your notification preferences.'
							: null,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Push debug GET error:', error);
		return NextResponse.json({ error: 'Failed to load push debug info' }, { status: 500 });
	}
}

/** Optional: pass current device endpoint to check server registration match. */
export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);
		const userId = session?.user?.id;
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = (await req.json().catch(() => ({}))) as { localEndpoint?: string };
		const localEndpoint = typeof body.localEndpoint === 'string' ? body.localEndpoint.trim() : '';

		const subscriptions = await prisma.pushSubscription.findMany({
			where: { userId, enabled: true },
			select: { endpoint: true },
		});

		const serverEndpoints = new Set(subscriptions.map(s => s.endpoint));
		const localEndpointRegistered = localEndpoint ? serverEndpoints.has(localEndpoint) : false;

		return NextResponse.json(
			{
				localEndpointRegistered,
				serverSubscriptionCount: subscriptions.length,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Push debug POST error:', error);
		return NextResponse.json({ error: 'Failed to check push registration' }, { status: 500 });
	}
}
