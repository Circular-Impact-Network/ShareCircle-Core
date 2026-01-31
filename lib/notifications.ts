import { prisma } from '@/lib/prisma';
import { NotificationType, NotificationStatus, Prisma } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseClient() {
	if (!supabaseUrl || !supabaseServiceKey) {
		console.warn('Supabase URL or Service Role Key not configured');
		return null;
	}
	return createClient(supabaseUrl, supabaseServiceKey);
}

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
 * Creates a notification and broadcasts it via realtime
 */
export async function createNotification({
	userId,
	type,
	entityId,
	title,
	body,
	metadata,
}: CreateNotificationParams) {
	const notification = await prisma.notification.create({
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

	// Broadcast notification via Supabase Realtime
	const supabase = getSupabaseClient();
	if (supabase) {
		try {
			await supabase.channel(`notifications:${userId}`).send({
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
		} catch (error) {
			console.error('Failed to broadcast notification:', error);
		}
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
			})
		)
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
	const supabase = getSupabaseClient();
	if (!supabase) return;

	try {
		await supabase.channel(`circle-requests:${circleId}`).send({
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
	} catch (error) {
		console.error('Failed to broadcast item request:', error);
	}
}

/**
 * Broadcast a status change event to a user's channel
 * This triggers UI refresh for borrow requests, transactions, etc.
 */
export async function broadcastStatusChange(userId: string, event: 'request_status_changed' | 'transaction_updated', data?: Record<string, unknown>) {
	const supabase = getSupabaseClient();
	if (!supabase) return;

	try {
		await supabase.channel(`notifications:${userId}`).send({
			type: 'broadcast',
			event,
			payload: data || {},
		});
	} catch (error) {
		console.error(`Failed to broadcast ${event}:`, error);
	}
}
