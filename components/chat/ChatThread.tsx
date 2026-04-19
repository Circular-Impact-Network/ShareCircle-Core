import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from './types';

type ChatThreadProps = {
	messages: ChatMessage[];
	currentUserId: string;
	onRetry: (message: ChatMessage) => void;
	searchValue: string;
	onLoadMore: () => void;
	hasMore: boolean;
	isLoading: boolean;
};

export function ChatThread({
	messages,
	currentUserId,
	onRetry,
	searchValue,
	onLoadMore,
	hasMore,
	isLoading,
}: ChatThreadProps) {
	const bottomRef = useRef<HTMLDivElement | null>(null);
	const topRef = useRef<HTMLDivElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const prevMessagesLengthRef = useRef(messages.length);
	const prevLastMessageIdRef = useRef<string | null>(null);
	const restoreScrollRef = useRef<{ top: number; height: number } | null>(null);

	useEffect(() => {
		// Only scroll if new messages were added (not loaded from history)
		const lastMessage = messages[messages.length - 1];
		const prevLastMessageId = prevLastMessageIdRef.current;
		const messagesAdded = messages.length > prevMessagesLengthRef.current;
		const isNewMessage = lastMessage && lastMessage.id !== prevLastMessageId;

		// Scroll to bottom only when:
		// 1. New messages were added (not loaded from history via "load more")
		// 2. The last message changed (not just a re-render)
		// 3. User is already near the bottom (within 100px)
		if (messagesAdded && isNewMessage && containerRef.current) {
			const container = containerRef.current;
			const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

			// Always scroll for own messages, otherwise only if near bottom
			const lastIsOwn = lastMessage?.senderId === currentUserId;
			if (lastIsOwn || isNearBottom) {
				bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
			}
		}

		// Update refs
		prevMessagesLengthRef.current = messages.length;
		prevLastMessageIdRef.current = lastMessage?.id ?? null;
	}, [messages, currentUserId]);

	useEffect(() => {
		if (!restoreScrollRef.current || !containerRef.current) return;
		const container = containerRef.current;
		const previous = restoreScrollRef.current;
		const heightDelta = container.scrollHeight - previous.height;
		container.scrollTop = previous.top + heightDelta;
		restoreScrollRef.current = null;
	}, [messages]);

	useEffect(() => {
		if (!hasMore || !topRef.current || !containerRef.current) return;

		const observer = new IntersectionObserver(
			entries => {
				if (!entries[0]?.isIntersecting || isLoading || !containerRef.current) return;
				restoreScrollRef.current = {
					top: containerRef.current.scrollTop,
					height: containerRef.current.scrollHeight,
				};
				onLoadMore();
			},
			{
				root: containerRef.current,
				rootMargin: '120px 0px 0px 0px',
				threshold: 0,
			},
		);

		observer.observe(topRef.current);
		return () => observer.disconnect();
	}, [hasMore, isLoading, onLoadMore]);

	return (
		<div className="flex flex-1 flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.08),_transparent_35%)]">
			<div ref={containerRef} className="app-scrollbar flex-1 space-y-4 overflow-auto px-4 py-5">
				<div ref={topRef} />
				{hasMore && (
					<div className="flex justify-center">
						<div className="rounded-full border border-border/70 bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm">
							{isLoading ? (
								<span className="inline-flex items-center gap-2">
									<Loader2 className="h-3.5 w-3.5 animate-spin" />
									Loading earlier messages
								</span>
							) : (
								'Scroll up to load earlier messages'
							)}
						</div>
					</div>
				)}
				{messages.length === 0 && !isLoading ? (
					<div className="rounded-2xl border border-dashed border-border/70 bg-background/70 px-4 py-10 text-center text-sm text-muted-foreground">
						No messages yet. Say hello to start the conversation.
					</div>
				) : (
					messages.map(message => (
						<MessageBubble
							key={message.id}
							message={message}
							isOwn={message.senderId === currentUserId}
							onRetry={onRetry}
							highlight={searchValue}
						/>
					))
				)}
				<div ref={bottomRef} />
			</div>
		</div>
	);
}
