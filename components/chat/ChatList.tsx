import { memo } from 'react';
import { Search, Pin, BellOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ChatThread } from './types';

type ChatListProps = {
	threads: ChatThread[];
	activeId: string | null;
	searchValue: string;
	onSearch: (value: string) => void;
	onSelect: (threadId: string) => void;
};

export const ChatList = memo(function ChatList({ threads, activeId, searchValue, onSearch, onSelect }: ChatListProps) {
	return (
		<div className="flex h-full w-full shrink-0 flex-col overflow-hidden border-b border-border/70 bg-card/90 md:w-[22rem] md:border-b-0 md:border-r">
			{/* Header — single row: title left, search right */}
			<div className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
				<p className="shrink-0 text-base font-semibold text-foreground">Messages</p>
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search chats…"
						className="h-9 rounded-xl border-border/70 bg-muted/60 pl-10 text-sm"
						value={searchValue}
						onChange={event => onSearch(event.target.value)}
					/>
				</div>
			</div>

			{/* Thread list */}
			<div className="app-scrollbar flex-1 overflow-auto bg-muted/20 pb-bottom-nav md:pb-0">
				{threads.length === 0 ? (
					<div className="px-4 py-12 text-center text-sm text-muted-foreground">
						No conversations yet.
					</div>
				) : (
					threads.map(thread => {
						const otherUser = thread.participants[0];
						const isActive = thread.id === activeId;
						const isPinned = Boolean(thread.pinnedAt);
						const isMuted = thread.mutedUntil && new Date(thread.mutedUntil) > new Date();
						const hasUnread = thread.unreadCount > 0;

						return (
							<button
								key={thread.id}
								onClick={() => onSelect(thread.id)}
								className={cn(
									'relative flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50',
									isActive && 'bg-primary/8',
								)}
							>
								{/* Unread indicator stripe */}
								{hasUnread && !isActive && (
									<span className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
								)}

								{/* Avatar with online-like size */}
								<div className="relative shrink-0">
									<Avatar className="h-12 w-12">
										<AvatarImage src={otherUser?.image || undefined} alt={otherUser?.name || 'User'} />
										<AvatarFallback className="bg-primary text-primary-foreground font-medium">
											{otherUser?.name?.[0]?.toUpperCase() || '?'}
										</AvatarFallback>
									</Avatar>
									{isPinned && (
										<span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-card">
											<Pin className="h-2.5 w-2.5 text-muted-foreground" />
										</span>
									)}
								</div>

								{/* Content */}
								<div className="min-w-0 flex-1">
									<div className="flex items-center justify-between gap-2">
										<p className={cn('truncate text-sm', hasUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/90')}>
											{otherUser?.name || 'Unknown'}
										</p>
										<div className="flex shrink-0 items-center gap-1.5">
											{isMuted && <BellOff className="h-3 w-3 text-muted-foreground/60" />}
											{thread.lastMessageAt && (
												<span className={cn('text-[11px]', hasUnread ? 'font-medium text-primary' : 'text-muted-foreground')}>
													{formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: false })}
												</span>
											)}
										</div>
									</div>
									<div className="mt-0.5 flex items-center justify-between gap-2">
										<p className={cn('truncate text-xs', hasUnread ? 'font-medium text-foreground/80' : 'text-muted-foreground')}>
											{thread.lastMessage?.body || 'Start a conversation'}
										</p>
										{hasUnread && (
											<span className="ml-2 flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
												{thread.unreadCount > 99 ? '99+' : thread.unreadCount}
											</span>
										)}
									</div>
								</div>
							</button>
						);
					})
				)}
			</div>
		</div>
	);
});
