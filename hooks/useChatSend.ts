'use client';

import { useCallback } from 'react';
import type { ChatMessage, ChatUser } from '@/components/chat/types';

type SendPayload = {
	attachments?: { type: 'IMAGE'; path: string; url: string }[];
};

type UseChatSendOptions = {
	threadId: string | null;
	currentUser: ChatUser | null;
	getMessageInput: () => string;
	clearMessageInput: () => void;
	setMessages: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
	onAfterSend?: () => void;
};

export function useChatSend({
	threadId,
	currentUser,
	getMessageInput,
	clearMessageInput,
	setMessages,
	onAfterSend,
}: UseChatSendOptions) {
	const markFailed = useCallback(
		(clientId: string) => {
			setMessages(prev =>
				prev.map(message => (message.clientId === clientId ? { ...message, localStatus: 'failed' } : message)),
			);
		},
		[setMessages],
	);

	const replaceWithSaved = useCallback(
		(clientId: string, saved: ChatMessage) => {
			setMessages(prev =>
				prev.map(message => (message.clientId === clientId ? { ...saved, localStatus: undefined } : message)),
			);
		},
		[setMessages],
	);

	const send = useCallback(
		async (payload?: SendPayload) => {
			if (!threadId || !currentUser) return;
			const body = getMessageInput().trim();
			const attachments = payload?.attachments || [];
			if (!body && attachments.length === 0) return;

			const clientId = crypto.randomUUID();
			const optimistic: ChatMessage = {
				id: `local-${clientId}`,
				conversationId: threadId,
				senderId: currentUser.id,
				body,
				createdAt: new Date().toISOString(),
				sender: currentUser,
				receipts: [],
				attachments: attachments.map((attachment, index) => ({
					id: `local-attachment-${clientId}-${index}`,
					type: attachment.type,
					url: attachment.url,
					metadata: { path: attachment.path },
				})),
				clientId,
				localStatus: 'sending',
			};

			setMessages(prev => [...prev, optimistic]);
			clearMessageInput();

			try {
				const response = await fetch(`/api/messages/threads/${threadId}/messages`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ body: optimistic.body, clientId, attachments }),
				});
				if (!response.ok) {
					markFailed(clientId);
					return;
				}
				const saved = (await response.json()) as ChatMessage;
				replaceWithSaved(clientId, saved);
				onAfterSend?.();
			} catch {
				markFailed(clientId);
			}
		},
		[threadId, currentUser, getMessageInput, clearMessageInput, setMessages, markFailed, replaceWithSaved, onAfterSend],
	);

	return { send, retry: async () => {} };
}
