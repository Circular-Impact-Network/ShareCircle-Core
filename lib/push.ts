import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

type PushPayload = {
	title: string;
	body: string;
	url?: string;
	tag?: string;
	data?: Record<string, unknown>;
};

export type SendPushOptions = {
	purpose?: string;
};

type WebPushSubscriptionRecord = {
	endpoint: string;
	expirationTime?: number | null;
	keys: {
		p256dh: string;
		auth: string;
	};
};

const ERROR_BODY_MAX = 2000;

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

function truncateBody(body: string | undefined | null): string | null {
	if (!body || typeof body !== 'string') {
		return null;
	}
	if (body.length <= ERROR_BODY_MAX) {
		return body;
	}
	return `${body.slice(0, ERROR_BODY_MAX)}…`;
}

async function recordPushSendAttempt(input: {
	userId: string;
	pushSubscriptionId: string | null;
	endpointHost: string;
	success: boolean;
	statusCode: number | null;
	errorMessage: string | null;
	errorBody: string | null;
	payloadTag: string | null;
	purpose: string;
}) {
	try {
		await prisma.pushSendAttempt.create({
			data: {
				userId: input.userId,
				pushSubscriptionId: input.pushSubscriptionId,
				endpointHost: input.endpointHost,
				success: input.success,
				statusCode: input.statusCode,
				errorMessage: input.errorMessage,
				errorBody: input.errorBody,
				payloadTag: input.payloadTag,
				purpose: input.purpose,
			},
		});
	} catch (e) {
		console.error('Failed to record push send attempt:', e);
	}
}

export async function sendPushToUser(userId: string, payload: PushPayload, options?: SendPushOptions) {
	const purpose = options?.purpose ?? 'notification';
	const payloadTag = payload.tag ?? null;

	if (!isPushConfigured()) {
		await recordPushSendAttempt({
			userId,
			pushSubscriptionId: null,
			endpointHost: 'push-not-configured',
			success: false,
			statusCode: null,
			errorMessage: 'Push notifications are not configured on the server.',
			errorBody: null,
			payloadTag,
			purpose,
		});
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
		await recordPushSendAttempt({
			userId,
			pushSubscriptionId: null,
			endpointHost: 'no-enabled-subscriptions',
			success: false,
			statusCode: null,
			errorMessage: 'No enabled push subscriptions found for this user.',
			errorBody: null,
			payloadTag,
			purpose,
		});
		return;
	}

	await Promise.all(
		subscriptions.map(async subscription => {
			let endpointHost = '';
			try {
				endpointHost = new URL(subscription.endpoint).hostname;
			} catch {
				endpointHost = 'invalid-endpoint';
			}

			try {
				const result = await webpush.sendNotification(
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

				await recordPushSendAttempt({
					userId,
					pushSubscriptionId: subscription.id,
					endpointHost,
					success: true,
					statusCode: result.statusCode ?? null,
					errorMessage: null,
					errorBody: truncateBody(result.body),
					payloadTag,
					purpose,
				});
			} catch (error) {
				const statusCode =
					error && typeof error === 'object' && 'statusCode' in error
						? (error as { statusCode?: number }).statusCode
						: undefined;
				const errBody =
					error && typeof error === 'object' && 'body' in error
						? String((error as { body?: unknown }).body ?? '')
						: '';
				console.error('Failed to send push notification:', {
					statusCode,
					endpointHost,
					message: error instanceof Error ? error.message : String(error),
				});

				await recordPushSendAttempt({
					userId,
					pushSubscriptionId: subscription.id,
					endpointHost,
					success: false,
					statusCode: statusCode ?? null,
					errorMessage: error instanceof Error ? error.message : String(error),
					errorBody: truncateBody(errBody),
					payloadTag,
					purpose,
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
