'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PageHeader, PageShell } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import { ChatList } from './ChatList';
import { ChatHeader } from './ChatHeader';
import { ChatThread } from './ChatThread';
import { MessageComposer } from './MessageComposer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useTypingIndicator } from '@/hooks/usePresence';
import { useGlobalPresence } from '@/hooks/useGlobalPresence';
import { useRealtimeChat } from '@/hooks/useRealtimeChat';
import { useUserMessages } from '@/hooks/useUserMessages';
import { AddItemModal } from '@/components/modals/add-item-modal';
import type { ChatMessage, ChatThread as ChatThreadType, ChatUser, MessageReceipt } from './types';

type ChatContainerProps = {
	initialThreadId?: string | null;
	initialMessageDraft?: string | null;
	showListOnly?: boolean;
	hideList?: boolean;
	fullBleed?: boolean;
};

const PAGE_SIZE = 30;

export function ChatContainer({
	initialThreadId = null,
	initialMessageDraft = null,
	showListOnly = false,
	hideList = false,
	fullBleed = false,
}: ChatContainerProps) {
	const router = useRouter();
	const { data: session } = useSession();
	const isDesktop = useMediaQuery('(min-width: 768px)');

	const currentUser: ChatUser | null = useMemo(() => {
		if (!session?.user?.id) return null;
		return {
			id: session.user.id,
			name: session.user.name || null,
			image: session.user.image || null,
		};
	}, [session]);

	const [threads, setThreads] = useState<ChatThreadType[]>([]);
	const [activeId, setActiveId] = useState<string | null>(initialThreadId);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [threadSearch, setThreadSearch] = useState('');
	const [messageSearch, setMessageSearch] = useState('');
	const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
	const [messageInput, setMessageInput] = useState('');
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [isLoadingThreads, setIsLoadingThreads] = useState(false);
	const [isLoadingMessages, setIsLoadingMessages] = useState(false);
	const [canMessage, setCanMessage] = useState(true);
	const [hasAppliedInitialDraft, setHasAppliedInitialDraft] = useState(false);
	const [showAddItem, setShowAddItem] = useState(false);

	const activeThread = threads.find(thread => thread.id === activeId) || null;
	const activeUser = activeThread?.participants[0] || null;

	// Global online status (tracked at Messages tab level)
	const { onlineUserIds } = useGlobalPresence();
	// Conversation-specific typing indicators
	const { typingUserIds, sendTyping } = useTypingIndicator(activeId, currentUser);

	const fetchThreads = useCallback(async () => {
		setIsLoadingThreads(true);
		try {
			const searchParam = threadSearch ? `?q=${encodeURIComponent(threadSearch)}` : '';
			const response = await fetch(`/api/messages/threads${searchParam}`);
			if (!response.ok) return;
			const data = (await response.json()) as ChatThreadType[];
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
				await fetch(`/api/messages/threads/${threadId}/read`, { method: 'POST' });
				setThreads(prev =>
					prev.map(thread =>
						thread.id === threadId
							? { ...thread, unreadCount: 0, lastReadAt: new Date().toISOString() }
							: thread,
					),
				);
				fetchThreads();
			} finally {
				setIsLoadingMessages(false);
			}
		},
		[fetchThreads],
	);

	useEffect(() => {
		if (!session?.user?.id) return;
		fetchThreads();
	}, [fetchThreads, session?.user?.id]);

	useEffect(() => {
		if (!activeId) return;
		fetchMessages(activeId);
	}, [activeId, fetchMessages]);

	useEffect(() => {
		if (messageSearch && !isMessageSearchOpen) {
			setIsMessageSearchOpen(true);
		}
	}, [messageSearch, isMessageSearchOpen]);

	useEffect(() => {
		if (!initialMessageDraft || hasAppliedInitialDraft) return;
		if (initialThreadId && activeId !== initialThreadId) return;
		setMessageInput(initialMessageDraft);
		setHasAppliedInitialDraft(true);
	}, [initialMessageDraft, hasAppliedInitialDraft, initialThreadId, activeId]);

	const handleSelectThread = (threadId: string) => {
		if (!isDesktop && !showListOnly) {
			setActiveId(threadId);
		} else if (!isDesktop) {
			router.push(`/messages/${threadId}`);
			return;
		}
		setActiveId(threadId);
	};

	const handleSend = async (payload?: { attachments: { type: 'IMAGE'; path: string; url: string }[] }) => {
		if (!activeId || !currentUser) return;
		const body = messageInput.trim();
		const attachments = payload?.attachments || [];
		if (!body && attachments.length === 0) return;
		const clientId = crypto.randomUUID();
		const optimistic: ChatMessage = {
			id: `local-${clientId}`,
			conversationId: activeId,
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
		setMessageInput('');

		try {
			const response = await fetch(`/api/messages/threads/${activeId}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ body: optimistic.body, clientId, attachments }),
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
			fetchThreads();
		} catch {
			setMessages(prev =>
				prev.map(message => (message.clientId === clientId ? { ...message, localStatus: 'failed' } : message)),
			);
		}
	};

	const handleRetry = async (message: ChatMessage) => {
		if (!activeId || !message.clientId) return;
		setMessages(prev =>
			prev.map(item => (item.clientId === message.clientId ? { ...item, localStatus: 'sending' } : item)),
		);
		try {
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
		} catch {
			setMessages(prev =>
				prev.map(item => (item.clientId === message.clientId ? { ...item, localStatus: 'failed' } : item)),
			);
		}
	};

	const handleToggleSearch = () => {
		setIsMessageSearchOpen(prev => {
			if (prev) {
				setMessageSearch('');
			}
			return !prev;
		});
	};

	const handleTogglePin = async (threadId: string, pinned: boolean) => {
		await fetch(`/api/messages/threads/${threadId}/pin`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ pinned }),
		});
		fetchThreads();
	};

	const handleArchive = async (threadId: string, archived: boolean) => {
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
	};

	const handleMute = async (threadId: string, muted: boolean) => {
		await fetch(`/api/messages/threads/${threadId}/mute`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ durationMinutes: muted ? 60 * 24 * 365 : 0 }),
		});
		fetchThreads();
	};

	const handleDelete = async (threadId: string) => {
		await fetch(`/api/messages/threads/${threadId}/delete`, { method: 'PATCH' });
		if (activeId === threadId) {
			setActiveId(null);
			setMessages([]);
		}
		fetchThreads();
	};

	const handleRealtimeMessage = useCallback(
		(message: ChatMessage) => {
			// If message is for a different conversation, just refresh threads
			if (message.conversationId && message.conversationId !== activeId) {
				fetchThreads();
				return;
			}
			setMessages(prev => {
				// Already present by real id — no-op
				if (prev.some(existing => existing.id === message.id)) {
					return prev;
				}
				// Race condition: broadcast arrived while the optimistic entry (local-*)
				// is still in state. Replace it so the HTTP response replacement won't
				// create a second message with the same real id.
				if (message.clientId) {
					const optimisticIdx = prev.findIndex(existing => existing.clientId === message.clientId);
					if (optimisticIdx !== -1) {
						const next = [...prev];
						next[optimisticIdx] = { ...message, localStatus: undefined };
						return next;
					}
				}
				return [...prev, message];
			});
			// Mark as read and refresh thread list
			if (activeId) {
				fetch(`/api/messages/threads/${activeId}/read`, { method: 'POST' });
			}
			fetchThreads();
		},
		[activeId, fetchThreads],
	);

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

	useRealtimeChat({
		conversationId: activeId,
		currentUserId: currentUser?.id || null,
		onMessage: handleRealtimeMessage,
		onReceipt: handleRealtimeReceipt,
	});

	// Listen for new messages across ALL conversations (even when not viewing a specific chat)
	// This updates the thread list in real-time
	const handleUserMessage = useCallback(
		(message: ChatMessage) => {
			// If this message is for the currently active conversation, it's already handled by useRealtimeChat
			if (message.conversationId === activeId) {
				return;
			}
			// For other conversations, just refresh the thread list to show the new message preview
			fetchThreads();
		},
		[activeId, fetchThreads],
	);

	useUserMessages({
		userId: currentUser?.id || null,
		onNewMessage: handleUserMessage,
	});

	const onLoadMore = () => {
		if (!activeId || !nextCursor) return;
		fetchMessages(activeId, nextCursor, true);
	};

	const showThreadPanel = isDesktop || (!isDesktop && !showListOnly);
	const isOnline = activeUser ? onlineUserIds.includes(activeUser.id) : false;
	const isTyping = activeUser ? typingUserIds.includes(activeUser.id) : false;

	return (
		<>
		<PageShell className={cn('flex flex-col', fullBleed && 'h-full max-w-none overflow-hidden')}>
			<div className="flex-shrink-0">
				<PageHeader title="Messages" description="Chat with people in your circles" />
			</div>
			<div
				className={cn(
					'flex flex-1 flex-col overflow-hidden md:flex-row',
					fullBleed
						? 'border-0'
						: 'min-h-[72vh] rounded-2xl border border-border/70 bg-card/30 shadow-sm backdrop-blur',
				)}
			>
				{!hideList && (
					<ChatList
						threads={threads}
						activeId={activeId}
						searchValue={threadSearch}
						onSearch={setThreadSearch}
						onSelect={handleSelectThread}
					/>
				)}

				{showThreadPanel && (
					<div
						className={cn(
							'flex flex-1 flex-col overflow-hidden rounded-2xl border border-border/70',
							fullBleed ? 'bg-card' : 'bg-background/40',
						)}
					>
						{activeUser ? (
							<>
								<ChatHeader
									user={activeUser}
									isOnline={isOnline}
									isTyping={isTyping}
									isPinned={Boolean(activeThread?.pinnedAt)}
									isMuted={Boolean(
										activeThread?.mutedUntil && new Date(activeThread.mutedUntil) > new Date(),
									)}
									isArchived={Boolean(activeThread?.archivedAt)}
									isSearchOpen={isMessageSearchOpen}
									searchValue={messageSearch}
									onTogglePin={() =>
										activeThread && handleTogglePin(activeThread.id, !activeThread.pinnedAt)
									}
									onToggleMute={() =>
										activeThread &&
										handleMute(
											activeThread.id,
											!(
												activeThread.mutedUntil &&
												new Date(activeThread.mutedUntil) > new Date()
											),
										)
									}
									onToggleArchive={() =>
										activeThread && handleArchive(activeThread.id, !activeThread.archivedAt)
									}
									onDelete={() => activeThread && handleDelete(activeThread.id)}
									onToggleSearch={handleToggleSearch}
									onSearchChange={setMessageSearch}
									onNewItem={() => setShowAddItem(true)}
								/>
								<ChatThread
									messages={messages}
									currentUserId={currentUser?.id || ''}
									onRetry={handleRetry}
									searchValue={messageSearch}
									onLoadMore={onLoadMore}
									hasMore={Boolean(nextCursor)}
									isLoading={isLoadingMessages}
								/>
								{!canMessage && (
									<div className="flex-shrink-0 border-t border-border bg-card p-4 text-center text-xs text-muted-foreground">
										Chat disabled. You no longer share a circle with this user.
									</div>
								)}
								<MessageComposer
									value={messageInput}
									onChange={setMessageInput}
									onSend={handleSend}
									onTyping={sendTyping}
									disabled={!canMessage}
								/>
							</>
						) : (
							<div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
								{isLoadingThreads ? 'Loading conversations...' : 'Select a chat to start'}
							</div>
						)}
					</div>
				)}
			</div>
		</PageShell>
		<AddItemModal open={showAddItem} onOpenChange={setShowAddItem} />
		</>
	);
}
