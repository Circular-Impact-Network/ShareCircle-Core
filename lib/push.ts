import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

type PushPayload = {
	title: string;
	body: string;
	url?: string;
	tag?: string;
	data?: Record<string, unknown>;
};

type WebPushSubscriptionRecord = {
	endpoint: string;
	expirationTime?: number | null;
	keys: {
		p256dh: string;
		auth: string;
	};
};

let vapidConfigured = false;

function getPushConfig() {
	const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	const subject = process.env.VAPID_SUBJECT;

	if (!publicKey || !privateKey || !subject) {
		return null;
	}

	if (!vapidConfigured) {
		webpush.setVapidDetails(subject, publicKey, privateKey);
		vapidConfigured = true;
	}

	return { publicKey, subject };
}

export function isPushConfigured() {
	return getPushConfig() !== null;
}

export function getPushPublicKey() {
	return getPushConfig()?.publicKey ?? null;
}

function toWebPushSubscription(subscription: {
	endpoint: string;
	p256dh: string;
	auth: string;
	expirationTime: Date | null;
}): WebPushSubscriptionRecord {
	return {
		endpoint: subscription.endpoint,
		expirationTime: subscription.expirationTime ? subscription.expirationTime.getTime() : null,
		keys: {
			p256dh: subscription.p256dh,
			auth: subscription.auth,
		},
	};
}

function isExpiredSubscriptionError(error: unknown) {
	if (!error || typeof error !== 'object') {
		return false;
	}

	const statusCode = 'statusCode' in error ? error.statusCode : null;
	return statusCode === 404 || statusCode === 410;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
	if (!isPushConfigured()) {
		return;
	}

	const subscriptions = await prisma.pushSubscription.findMany({
		where: {
			userId,
			enabled: true,
		},
		select: {
			id: true,
			endpoint: true,
			p256dh: true,
			auth: true,
			expirationTime: true,
		},
	});

	if (subscriptions.length === 0) {
		return;
	}

	await Promise.all(
		subscriptions.map(async subscription => {
			let endpointHost = '';
			try {
				endpointHost = new URL(subscription.endpoint).hostname;
			} catch {
				/* ignore */
			}

			try {
				await webpush.sendNotification(
					toWebPushSubscription(subscription),
					JSON.stringify({
						title: payload.title,
						body: payload.body,
						url: payload.url || '/notifications',
						tag: payload.tag,
						data: payload.data ?? {},
					}),
					{
						urgency: 'high',
						TTL: 86_400,
					},
				);
			} catch (error) {
				const statusCode =
					error && typeof error === 'object' && 'statusCode' in error
						? (error as { statusCode?: number }).statusCode
						: undefined;
				console.error('Failed to send push notification:', {
					statusCode,
					endpointHost,
					message: error instanceof Error ? error.message : String(error),
				});

				if (isExpiredSubscriptionError(error)) {
					await prisma.pushSubscription.delete({
						where: { id: subscription.id },
					});
				}
			}
		}),
	);
}
