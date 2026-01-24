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

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [messages.length]);

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
			<div className="flex-1 space-y-4 overflow-auto p-4">
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
