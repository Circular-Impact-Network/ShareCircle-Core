export type ChatUser = {
	id: string;
	name: string | null;
	image: string | null;
};

export type MessageReceipt = {
	id: string;
	messageId: string;
	userId: string;
	deliveredAt: string | null;
	readAt: string | null;
};

export type MessageAttachment = {
	id: string;
	type: string;
	url: string;
	metadata?: Record<string, unknown> | null;
};

// ContextRef is the canonical shape attached to a chat message. The single
// source of truth (with Zod schema + server-side resolver) is in
// lib/chat-context-ref.ts — re-exported here so existing chat-type imports
// keep working.
import type { ContextRef } from '@/lib/chat-context-ref';
export type { ContextRef };

export type ChatMessage = {
	id: string;
	conversationId?: string;
	senderId: string;
	body: string;
	messageType?: string;
	createdAt: string;
	sender: ChatUser;
	receipts: MessageReceipt[];
	attachments: MessageAttachment[];
	contextRef?: ContextRef | null;
	clientId?: string;
	localStatus?: 'sending' | 'failed';
};

export type ChatThread = {
	id: string;
	type: 'DIRECT' | 'GROUP';
	lastMessageAt: string | null;
	lastMessage?: {
		id: string;
		body: string;
		senderId: string;
		createdAt: string;
		messageType: string;
	} | null;
	participants: ChatUser[];
	unreadCount: number;
	pinnedAt: string | null;
	archivedAt: string | null;
	mutedUntil: string | null;
	deletedAt: string | null;
	lastReadAt: string | null;
	canMessage: boolean;
};
