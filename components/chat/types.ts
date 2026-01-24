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
