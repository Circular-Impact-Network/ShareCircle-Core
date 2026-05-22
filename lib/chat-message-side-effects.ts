import { NotificationType, type AttachmentType, type Prisma } from '@prisma/client';
import { queueNotification } from '@/lib/notify';
import { supabaseAdmin } from '@/lib/supabase';
import type { ContextRef } from '@/lib/chat-context-ref';

type MessageSender = { name: string | null };

type PersistedAttachment = {
	id: string;
	type: AttachmentType;
	url: string;
	metadata?: unknown;
};

// Note on contextRef typing: Prisma surfaces JSON columns as Prisma.JsonValue.
// We persist only ContextRef-shaped objects (validated via contextRefSchema +
// resolveContextRef on write), so we narrow back to ContextRef | null when
// building the broadcast payload below.
type PersistedChatMessage = {
	id: string;
	body: string | null;
	createdAt: Date;
	clientId: string | null;
	conversationId: string;
	senderId: string;
	sender: MessageSender;
	attachments: PersistedAttachment[];
	contextRef?: Prisma.JsonValue | null;
};

type MessageReceiptRow = {
	id: string;
	messageId: string;
	userId: string;
	deliveredAt: Date | null;
	readAt: Date | null;
};

/**
 * After a chat message is committed: Supabase realtime broadcasts + queued notifications.
 *
 * Broadcasts are sent inline so recipients see the message immediately.
 * Notifications (in-app row + web push) are queued via after() so they
 * never block the HTTP response or crash the handler on failure.
 */
export async function runAfterNewChatMessagePersisted(options: {
	conversationId: string;
	senderId: string;
	recipientIds: string[];
	notificationRecipientIds: string[];
	createdMessage: PersistedChatMessage;
	receipts: MessageReceiptRow[];
}) {
	const { conversationId, senderId, recipientIds, notificationRecipientIds, createdMessage, receipts } = options;

	const messagePayload = {
		id: createdMessage.id,
		conversationId: createdMessage.conversationId,
		senderId: createdMessage.senderId,
		body: createdMessage.body,
		createdAt: createdMessage.createdAt.toISOString(),
		clientId: createdMessage.clientId,
		sender: createdMessage.sender,
		receipts,
		attachments: createdMessage.attachments,
		contextRef: (createdMessage.contextRef ?? null) as ContextRef | null,
	};

	try {
		const broadcastPromises: Promise<unknown>[] = [];

		const conversationChannel = supabaseAdmin.channel(`messages:${conversationId}`);
		broadcastPromises.push(
			conversationChannel
				.send({ type: 'broadcast', event: 'new_message', payload: messagePayload })
				.then(() => supabaseAdmin.removeChannel(conversationChannel)),
		);

		for (const recipientId of recipientIds) {
			const userChannel = supabaseAdmin.channel(`user:${recipientId}:messages`);
			broadcastPromises.push(
				userChannel
					.send({ type: 'broadcast', event: 'new_message', payload: messagePayload })
					.then(() => supabaseAdmin.removeChannel(userChannel)),
			);
		}

		await Promise.all(broadcastPromises);
	} catch (broadcastError) {
		console.error('Failed to broadcast message:', broadcastError);
	}

	const senderDisplayName = createdMessage.sender?.name?.trim() || 'New message';
	const notificationBody =
		createdMessage.body ||
		(createdMessage.attachments.length === 1
			? 'Sent a photo'
			: createdMessage.attachments.length > 1
				? `Sent ${createdMessage.attachments.length} photos`
				: 'Sent a message');

	for (const recipientId of notificationRecipientIds) {
		queueNotification({
			userId: recipientId,
			type: NotificationType.NEW_MESSAGE,
			entityId: createdMessage.id,
			title: senderDisplayName,
			body: notificationBody,
			metadata: {
				conversationId,
				messageId: createdMessage.id,
				senderId,
			},
		});
	}
}
