import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from './types';

type ChatThreadProps = {
	messages: ChatMessage[];
	currentUserId: string;
	onRetry: (message: ChatMessage) => void;
	searchValue: string;
	onSearchChange: (value: string) => void;
	onLoadMore: () => void;
	hasMore: boolean;
	isLoading: boolean;
};

export function ChatThread({
	messages,
	currentUserId,
	onRetry,
	searchValue,
	onSearchChange,
	onLoadMore,
	hasMore,
	isLoading,
}: ChatThreadProps) {
	const bottomRef = useRef<HTMLDivElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const prevMessagesLengthRef = useRef(messages.length);
	const prevLastMessageIdRef = useRef<string | null>(null);

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

	return (
		<div className="flex flex-1 flex-col overflow-hidden">
			<div className="border-b border-border bg-card p-3">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search in chat..."
						className="pl-10"
						value={searchValue}
						onChange={event => onSearchChange(event.target.value)}
					/>
				</div>
			</div>
			<div ref={containerRef} className="flex-1 space-y-4 overflow-auto p-4">
				{hasMore && (
					<div className="flex justify-center">
						<Button variant="ghost" size="sm" onClick={onLoadMore} disabled={isLoading}>
							{isLoading ? 'Loading...' : 'Load earlier messages'}
						</Button>
					</div>
				)}
				{messages.length === 0 && !isLoading ? (
					<p className="text-center text-sm text-muted-foreground">No messages yet.</p>
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
