import { Search, Pin, BellOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ChatThread } from './types';

type ChatListProps = {
	threads: ChatThread[];
	activeId: string | null;
	searchValue: string;
	onSearch: (value: string) => void;
	onSelect: (threadId: string) => void;
};

export function ChatList({
	threads,
	activeId,
	searchValue,
	onSearch,
	onSelect,
}: ChatListProps) {
	return (
		<div className="flex h-full w-full flex-shrink-0 flex-col overflow-hidden border-b border-border bg-card md:w-80 md:border-b-0 md:border-r md:rounded-l-lg">
			<div className="border-b border-border p-4">
				<div className="relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search chats..."
						className="pl-10"
						value={searchValue}
						onChange={event => onSearch(event.target.value)}
					/>
				</div>
			</div>

			<div className="flex-1 overflow-auto">
				{threads.length === 0 ? (
					<div className="p-6 text-center text-sm text-muted-foreground">No conversations yet.</div>
				) : (
					threads.map(thread => {
						const otherUser = thread.participants[0];
						const isActive = thread.id === activeId;
						const isPinned = Boolean(thread.pinnedAt);
						const isMuted = thread.mutedUntil && new Date(thread.mutedUntil) > new Date();
						return (
							<button
								key={thread.id}
								onClick={() => onSelect(thread.id)}
								className={cn(
									'group relative w-full border-b border-border p-4 text-left transition-colors hover:bg-muted',
									isActive && 'bg-accent/10',
								)}
							>
								{isPinned && (
									<Pin className="absolute left-1 top-1 h-3 w-3 text-muted-foreground" />
								)}
								<div className="flex items-center gap-3">
									<Avatar className="h-10 w-10 flex-shrink-0">
										<AvatarImage src={otherUser?.image || undefined} alt={otherUser?.name || 'User'} />
										<AvatarFallback className="bg-primary text-primary-foreground text-sm">
											{otherUser?.name?.[0]?.toUpperCase() || '?'}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0 flex-1 space-y-1">
										<div className="flex items-center gap-2">
											<p className="truncate text-sm font-semibold text-foreground">
												{otherUser?.name || 'Unknown'}
											</p>
											{isMuted && <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
										</div>
										<p className="truncate text-xs text-muted-foreground">
											{thread.lastMessage?.body || 'Start a conversation'}
										</p>
									</div>
									{thread.unreadCount > 0 && (
										<Badge className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px]">
											{thread.unreadCount}
										</Badge>
									)}
								</div>
							</button>
						);
					})
				)}
			</div>
		</div>
	);
}
