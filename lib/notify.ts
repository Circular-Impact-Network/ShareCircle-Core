import { after } from 'next/server';
import { NotificationType } from '@prisma/client';
import { createNotification, notifyCircleMembers } from '@/lib/notifications';
import { supabaseAdmin } from '@/lib/supabase';

type NotifyParams = {
	userId: string;
	type: NotificationType;
	entityId?: string;
	title: string;
	body: string;
	metadata?: Record<string, unknown>;
};

type CircleNotifyParams = {
	circleId: string;
	actorId: string;
	type: NotificationType;
	entityId?: string;
	title: string;
	body: string;
	metadata?: Record<string, unknown>;
};

const NOTIFICATION_PATHS: Record<NotificationType, (m: Record<string, unknown>) => string> = {
	NEW_MESSAGE: m => `/messages/${m.conversationId ?? ''}`,
	ITEM_REQUEST_CREATED: () => '/requests',
	ITEM_REQUEST_FULFILLED: () => '/requests',
	BORROW_REQUEST_RECEIVED: () => '/activity',
	BORROW_REQUEST_APPROVED: () => '/activity',
	BORROW_REQUEST_DECLINED: () => '/activity',
	QUEUE_POSITION_UPDATED: () => '/activity',
	QUEUE_ITEM_READY: () => '/activity',
	RETURN_REQUESTED: () => '/activity',
	RETURN_CONFIRMED: () => '/activity',
};

function resolvePath(type: NotificationType, metadata?: Record<string, unknown>): string {
	return metadata ? NOTIFICATION_PATHS[type](metadata) : '/notifications';
}

/**
 * Queue a notification to run after the HTTP response via next/server after().
 * Non-blocking, error-isolated, and reliable in serverless.
 */
export function queueNotification(params: NotifyParams): void {
	const path = resolvePath(params.type, params.metadata);
	const metadata = { ...params.metadata, path };

	after(async () => {
		try {
			await createNotification({ ...params, metadata });
		} catch (error) {
			console.error(`Notification failed [${params.type}] to ${params.userId}:`, error);
		}
	});
}

/**
 * Queue notifications for all members of a circle (except the actor).
 */
export function queueCircleNotification(params: CircleNotifyParams): void {
	const path = resolvePath(params.type, params.metadata);
	const metadata = { ...params.metadata, path };

	after(async () => {
		try {
			await notifyCircleMembers({ ...params, metadata });
		} catch (error) {
			console.error(`Circle notification failed [${params.type}] for circle ${params.circleId}:`, error);
		}
	});
}

/**
 * Queue a Supabase Realtime broadcast to run after the HTTP response.
 */
export function queueBroadcast(channelName: string, event: string, payload: Record<string, unknown>): void {
	after(async () => {
		try {
			const channel = supabaseAdmin.channel(channelName);
			await channel.send({ type: 'broadcast', event, payload });
			await supabaseAdmin.removeChannel(channel);
		} catch (error) {
			console.error(`Broadcast failed [${channelName}/${event}]:`, error);
		}
	});
}
