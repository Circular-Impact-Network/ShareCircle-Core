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
						return (
							<button
								key={thread.id}
								onClick={() => onSelect(thread.id)}
								className={cn(
									'group relative mb-1 w-full rounded-2xl border border-transparent px-3 py-3 text-left transition-all hover:border-border/70 hover:bg-muted/60',
									isActive && 'border-primary/30 bg-primary/5 shadow-sm',
								)}
							>
								{isPinned && <Pin className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />}
								<div className="flex items-start gap-3">
									<Avatar className="h-10 w-10 flex-shrink-0">
										<AvatarImage
											src={otherUser?.image || undefined}
											alt={otherUser?.name || 'User'}
										/>
										<AvatarFallback className="bg-primary text-primary-foreground text-sm">
											{otherUser?.name?.[0]?.toUpperCase() || '?'}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0 flex-1 space-y-1">
										<div className="flex items-start justify-between gap-2">
											<p className="truncate text-sm font-semibold text-foreground">
												{otherUser?.name || 'Unknown'}
											</p>
											<div className="flex items-center gap-2">
												{isMuted ? (
													<BellOff className="h-3.5 w-3.5 text-muted-foreground" />
												) : null}
												{thread.lastMessageAt ? (
													<span className="shrink-0 text-[11px] text-muted-foreground">
														{formatDistanceToNow(new Date(thread.lastMessageAt), {
															addSuffix: true,
														})}
													</span>
												) : null}
											</div>
										</div>
										<p
											className={cn(
												'truncate text-xs',
												thread.unreadCount > 0
													? 'font-medium text-foreground'
													: 'text-muted-foreground',
											)}
										>
											{thread.lastMessage?.body || 'Start a conversation'}
										</p>
										<div className="flex items-center gap-2">
											{thread.unreadCount > 0 ? (
												<Badge className="rounded-full px-2 py-0.5 text-[10px]">
													{thread.unreadCount} new
												</Badge>
											) : (
												<span className="text-[11px] text-muted-foreground">
													No unread messages
												</span>
											)}
										</div>
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
