import { prisma } from '@/lib/prisma';
import { getEffectiveNotificationChannels } from '@/lib/notification-preferences';
import { sendPushToUser } from '@/lib/push';
import { supabaseAdmin } from '@/lib/supabase';
import { NotificationType, NotificationStatus, Prisma, type Notification } from '@prisma/client';

interface CreateNotificationParams {
	userId: string;
	type: NotificationType;
	entityId?: string;
	title: string;
	body: string;
	metadata?: Record<string, unknown>;
}

interface NotifyCircleMembersParams {
	circleId: string;
	actorId: string;
	type: NotificationType;
	entityId?: string;
	title: string;
	body: string;
	metadata?: Record<string, unknown>;
}

/**
 * Creates a notification and broadcasts it via realtime (in-app), and/or sends Web Push, per user preferences.
 */
export async function createNotification({
	userId,
	type,
	entityId,
	title,
	body,
	metadata,
}: CreateNotificationParams): Promise<Notification | null> {
	const channels = await getEffectiveNotificationChannels(userId, type);
	if (!channels.inApp && !channels.push) {
		return null;
	}

	const targetPath = metadata && typeof metadata.path === 'string' ? metadata.path : '/notifications';

	let notification: Notification | null = null;

	if (channels.inApp) {
		notification = await prisma.notification.create({
			data: {
				userId,
				type,
				entityId,
				title,
				body,
				metadata: (metadata || {}) as Prisma.InputJsonValue,
				status: NotificationStatus.UNREAD,
			},
		});

		try {
			const channel = supabaseAdmin.channel(`notifications:${userId}`);
			await channel.send({
				type: 'broadcast',
				event: 'new_notification',
				payload: {
					id: notification.id,
					type: notification.type,
					entityId: notification.entityId,
					title: notification.title,
					body: notification.body,
					metadata: notification.metadata,
					createdAt: notification.createdAt.toISOString(),
				},
			});
			await supabaseAdmin.removeChannel(channel);
		} catch (error) {
			console.error('Failed to broadcast notification:', error);
		}
	}

	if (channels.push) {
		// Unique tag per entity when possible so Android does not replace every message with one tray item.
		const pushTag = entityId ? `${type}:${entityId}` : type;
		await sendPushToUser(userId, {
			title,
			body,
			url: targetPath,
			tag: pushTag,
			data: {
				...(notification
					? {
							notificationId: notification.id,
							type: notification.type,
							entityId: notification.entityId,
						}
					: {
							type,
							entityId: entityId ?? null,
						}),
				path: targetPath,
			},
		});
	}

	return notification;
}

/**
 * Create notifications for all members of a circle (except the actor)
 */
export async function notifyCircleMembers({
	circleId,
	actorId,
	type,
	entityId,
	title,
	body,
	metadata,
}: NotifyCircleMembersParams) {
	// Get all circle members except the actor
	const members = await prisma.circleMember.findMany({
		where: {
			circleId,
			leftAt: null,
			userId: { not: actorId },
		},
		select: { userId: true },
	});

	// Create notifications for all members
	const notifications = await Promise.all(
		members.map(member =>
			createNotification({
				userId: member.userId,
				type,
				entityId,
				title,
				body,
				metadata,
			}),
		),
	);

	return notifications;
}

interface BroadcastItemRequestParams {
	circleId: string;
	request: {
		id: string;
		title: string;
		description: string | null;
		status: string;
		desiredFrom: Date | null;
		desiredTo: Date | null;
		createdAt: Date;
		requester: {
			id: string;
			name: string | null;
			image: string | null;
		};
		circle: {
			id: string;
			name: string;
		};
	};
}

/**
 * Broadcast a new item request to the circle channel
 */
export async function broadcastItemRequest({ circleId, request }: BroadcastItemRequestParams) {
	try {
		const channel = supabaseAdmin.channel(`circle-requests:${circleId}`);
		await channel.send({
			type: 'broadcast',
			event: 'new_item_request',
			payload: {
				id: request.id,
				title: request.title,
				description: request.description,
				status: request.status,
				desiredFrom: request.desiredFrom?.toISOString() || null,
				desiredTo: request.desiredTo?.toISOString() || null,
				createdAt: request.createdAt.toISOString(),
				requester: request.requester,
				circle: request.circle,
			},
		});
		await supabaseAdmin.removeChannel(channel);
	} catch (error) {
		console.error('Failed to broadcast item request:', error);
	}
}

/**
 * Broadcast a status change event to a user's channel
 * This triggers UI refresh for borrow requests, transactions, etc.
 */
export async function broadcastStatusChange(
	userId: string,
	event: 'request_status_changed' | 'transaction_updated',
	data?: Record<string, unknown>,
) {
	try {
		const channel = supabaseAdmin.channel(`notifications:${userId}`);
		await channel.send({
			type: 'broadcast',
			event,
			payload: data || {},
		});
		await supabaseAdmin.removeChannel(channel);
	} catch (error) {
		console.error(`Failed to broadcast ${event}:`, error);
	}
}
