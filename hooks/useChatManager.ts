import { useCallback, useEffect, useState } from 'react';
import type { ChatMessage, ChatThread, ChatUser, MessageReceipt } from '@/components/chat/types';
import { useRealtimeChat } from './useRealtimeChat';
import { useUserMessages } from './useUserMessages';

const PAGE_SIZE = 30;

type UseChatManagerOptions = {
	currentUser: ChatUser | null;
	initialThreadId?: string | null;
	isDesktop: boolean;
};

type UseChatManagerReturn = {
	// State
	threads: ChatThread[];
	activeId: string | null;
	messages: ChatMessage[];
	threadSearch: string;
	nextCursor: string | null;
	isLoadingThreads: boolean;
	isLoadingMessages: boolean;
	canMessage: boolean;
	activeThread: ChatThread | null;
	activeUser: ChatUser | null;
	
	// Setters
	setActiveId: (id: string | null) => void;
	setThreadSearch: (search: string) => void;
	
	// Actions
	fetchThreads: () => Promise<void>;
	fetchMessages: (threadId: string, cursor?: string | null, append?: boolean) => Promise<void>;
	sendMessage: (body: string) => Promise<void>;
	retryMessage: (message: ChatMessage) => Promise<void>;
	togglePin: (threadId: string, pinned: boolean) => Promise<void>;
	archiveThread: (threadId: string, archived: boolean) => Promise<void>;
	muteThread: (threadId: string, muted: boolean) => Promise<void>;
	deleteThread: (threadId: string) => Promise<void>;
	loadMoreMessages: () => void;
};

/**
 * Custom hook that manages chat state and operations.
 * Extracts the complex logic from ChatContainer for better maintainability and testability.
 */
export function useChatManager({
	currentUser,
	initialThreadId = null,
	isDesktop,
}: UseChatManagerOptions): UseChatManagerReturn {
	const [threads, setThreads] = useState<ChatThread[]>([]);
	const [activeId, setActiveId] = useState<string | null>(initialThreadId);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [threadSearch, setThreadSearch] = useState('');
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [isLoadingThreads, setIsLoadingThreads] = useState(false);
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);
	const [canMessage, setCanMessage] = useState(true);

	const activeThread = threads.find(thread => thread.id === activeId) || null;
	const activeUser = activeThread?.participants[0] || null;

	// Fetch threads
	const fetchThreads = useCallback(async () => {
		setIsLoadingThreads(true);
		try {
			const searchParam = threadSearch ? `?q=${encodeURIComponent(threadSearch)}` : '';
			const response = await fetch(`/api/messages/threads${searchParam}`);
			if (!response.ok) return;
			const data = (await response.json()) as ChatThread[];
			const sorted = [...data].sort((a, b) => {
				if (a.pinnedAt && !b.pinnedAt) return -1;
				if (!a.pinnedAt && b.pinnedAt) return 1;
				return new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime();
			});
			setThreads(sorted);
			if (isDesktop && !activeId && sorted.length > 0) {
				setActiveId(sorted[0].id);
			}
		} finally {
			setIsLoadingThreads(false);
		}
	}, [threadSearch, activeId, isDesktop]);

	// Fetch messages for a thread
	const fetchMessages = useCallback(
		async (threadId: string, cursor?: string | null, append = false) => {
			setIsLoadingMessages(true);
			try {
				const params = new URLSearchParams();
				params.set('limit', String(PAGE_SIZE));
				if (cursor) params.set('cursor', cursor);
				const response = await fetch(`/api/messages/threads/${threadId}/messages?${params.toString()}`);
				if (!response.ok) return;
				const data = await response.json();
				setCanMessage(Boolean(data.canMessage));
				setNextCursor(data.nextCursor ?? null);
				const incoming = data.messages as ChatMessage[];
				setMessages(prev => (append ? [...incoming, ...prev] : incoming));
				// Mark as read
				await fetch(`/api/messages/threads/${threadId}/read`, { method: 'POST' });
				// Update thread unread count locally
				setThreads(prev =>
					prev.map(thread =>
						thread.id === threadId
							? { ...thread, unreadCount: 0, lastReadAt: new Date().toISOString() }
							: thread,
					),
				);
			} finally {
				setIsLoadingMessages(false);
			}
		},
		[],
	);

	// Send a message
	const sendMessage = useCallback(
		async (body: string) => {
			if (!activeId || !body.trim() || !currentUser) return;
			
			const clientId = crypto.randomUUID();
			const optimistic: ChatMessage = {
				id: `local-${clientId}`,
				conversationId: activeId,
				senderId: currentUser.id,
				body: body.trim(),
				createdAt: new Date().toISOString(),
				sender: currentUser,
				receipts: [],
				attachments: [],
				clientId,
				localStatus: 'sending',
			};

			setMessages(prev => [...prev, optimistic]);

			const response = await fetch(`/api/messages/threads/${activeId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ body: optimistic.body, clientId }),
			});

			if (!response.ok) {
				setMessages(prev =>
					prev.map(message =>
						message.clientId === clientId ? { ...message, localStatus: 'failed' } : message,
					),
				);
				return;
			}

			const saved = (await response.json()) as ChatMessage;
			setMessages(prev =>
				prev.map(message => (message.clientId === clientId ? { ...saved, localStatus: undefined } : message)),
			);
			
			// Update thread list to show new message
			fetchThreads();
		},
		[activeId, currentUser, fetchThreads],
	);

	// Retry a failed message
	const retryMessage = useCallback(
		async (message: ChatMessage) => {
			if (!activeId || !message.clientId) return;
			
			setMessages(prev =>
				prev.map(item => (item.clientId === message.clientId ? { ...item, localStatus: 'sending' } : item)),
			);
			
			const response = await fetch(`/api/messages/threads/${activeId}/retry`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ body: message.body, clientId: message.clientId }),
			});
			
			if (!response.ok) {
				setMessages(prev =>
					prev.map(item => (item.clientId === message.clientId ? { ...item, localStatus: 'failed' } : item)),
				);
				return;
			}
			
			const saved = (await response.json()) as ChatMessage;
			setMessages(prev =>
				prev.map(item => (item.clientId === message.clientId ? { ...saved, localStatus: undefined } : item)),
			);
			fetchThreads();
		},
		[activeId, fetchThreads],
	);

	// Toggle pin on a thread
	const togglePin = useCallback(
		async (threadId: string, pinned: boolean) => {
			await fetch(`/api/messages/threads/${threadId}/pin`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pinned }),
			});
			fetchThreads();
		},
		[fetchThreads],
	);

	// Archive a thread
	const archiveThread = useCallback(
		async (threadId: string, archived: boolean) => {
			await fetch(`/api/messages/threads/${threadId}/archive`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ archived }),
			});
			if (activeId === threadId) {
				setActiveId(null);
				setMessages([]);
			}
			fetchThreads();
		},
		[activeId, fetchThreads],
	);

	// Mute a thread
	const muteThread = useCallback(
		async (threadId: string, muted: boolean) => {
			await fetch(`/api/messages/threads/${threadId}/mute`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ durationMinutes: muted ? 60 * 24 * 365 : 0 }),
			});
			fetchThreads();
		},
		[fetchThreads],
	);

	// Delete a thread
	const deleteThread = useCallback(
		async (threadId: string) => {
			await fetch(`/api/messages/threads/${threadId}/delete`, { method: 'PATCH' });
			if (activeId === threadId) {
				setActiveId(null);
				setMessages([]);
			}
			fetchThreads();
		},
		[activeId, fetchThreads],
	);

	// Handle realtime messages
	const handleRealtimeMessage = useCallback(
		(message: ChatMessage) => {
			if (message.conversationId && message.conversationId !== activeId) {
				fetchThreads();
				return;
			}
			setMessages(prev => {
				if (prev.some(existing => existing.id === message.id)) {
					return prev;
				}
				return [...prev, message];
			});
			if (activeId) {
				fetch(`/api/messages/threads/${activeId}/read`, { method: 'POST' });
			}
			fetchThreads();
		},
		[activeId, fetchThreads],
	);

	// Handle realtime receipts
	const handleRealtimeReceipt = useCallback((receipt: MessageReceipt) => {
		setMessages(prev =>
			prev.map(message =>
				message.id === receipt.messageId
					? {
							...message,
							receipts: message.receipts.some(r => r.id === receipt.id)
								? message.receipts.map(r => (r.id === receipt.id ? receipt : r))
								: [...message.receipts, receipt],
						}
					: message,
			),
		);
	}, []);

	// Handle user messages (for other conversations)
	const handleUserMessage = useCallback(
		(message: ChatMessage) => {
			if (message.conversationId === activeId) {
				return;
			}
			fetchThreads();
		},
		[activeId, fetchThreads],
	);

	// Subscribe to realtime chat for active conversation
	useRealtimeChat({
		conversationId: activeId,
		currentUserId: currentUser?.id || null,
		onMessage: handleRealtimeMessage,
		onReceipt: handleRealtimeReceipt,
	});

	// Subscribe to user messages for all conversations
	useUserMessages({
		userId: currentUser?.id || null,
		onNewMessage: handleUserMessage,
	});

	// Initial fetch
	useEffect(() => {
		if (!currentUser?.id) return;
		fetchThreads();
	}, [currentUser?.id, fetchThreads]);

	// Fetch messages when active thread changes
	useEffect(() => {
		if (!activeId) return;
		fetchMessages(activeId);
	}, [activeId, fetchMessages]);

	const loadMoreMessages = useCallback(() => {
		if (!activeId || !nextCursor) return;
		fetchMessages(activeId, nextCursor, true);
	}, [activeId, nextCursor, fetchMessages]);

	return {
		threads,
		activeId,
		messages,
		threadSearch,
		nextCursor,
		isLoadingThreads,
		isLoadingMessages,
		canMessage,
		activeThread,
		activeUser,
		setActiveId,
		setThreadSearch,
		fetchThreads,
		fetchMessages,
		sendMessage,
		retryMessage,
		togglePin,
		archiveThread,
		muteThread,
		deleteThread,
		loadMoreMessages,
	};
}
