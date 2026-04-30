import { Archive, ArrowLeft, BellOff, MoreVertical, Pin, Plus, Search, Trash2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { ChatUser } from './types';

type ChatHeaderProps = {
	user: ChatUser | null;
	isOnline: boolean;
	isTyping: boolean;
	isPinned: boolean;
	isMuted: boolean;
	isArchived: boolean;
	isSearchOpen: boolean;
	searchValue: string;
	onBack?: () => void;
	onTogglePin: () => void;
	onToggleMute: () => void;
	onToggleArchive: () => void;
	onDelete: () => void;
	onToggleSearch: () => void;
	onSearchChange: (value: string) => void;
	onNewItem?: () => void;
};

export function ChatHeader({
	user,
	isOnline,
	isTyping,
	isPinned,
	isMuted,
	isArchived,
	isSearchOpen,
	searchValue,
	onTogglePin,
	onToggleMute,
	onToggleArchive,
	onDelete,
	onToggleSearch,
	onSearchChange,
	onNewItem,
}: ChatHeaderProps) {
	return (
		<div className="border-b border-border/70 bg-card/90 px-4 py-3">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<Avatar className="h-10 w-10">
						<AvatarImage src={user?.image || undefined} alt={user?.name || 'User'} />
						<AvatarFallback className="bg-primary text-primary-foreground">
							{user?.name?.[0]?.toUpperCase() || '?'}
						</AvatarFallback>
					</Avatar>
					<div className="space-y-0.5">
						<p className="font-semibold text-foreground">{user?.name || 'Unknown'}</p>
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<span className="inline-flex items-center gap-1">
								<span
									className={`h-2 w-2 rounded-full ${
										isTyping
											? 'bg-amber-500'
											: isOnline
												? 'bg-emerald-500'
												: 'bg-muted-foreground/50'
									}`}
								/>
								{isTyping ? 'typing...' : isOnline ? 'online' : 'offline'}
							</span>
							{isArchived ? <span>Archived</span> : null}
						</div>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{onNewItem && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="h-8 gap-1.5 rounded-full text-xs"
							onClick={onNewItem}
						>
							<Plus className="h-3.5 w-3.5" />
							Add Item
						</Button>
					)}
					{isSearchOpen && (
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search in chat..."
								className="h-9 w-44 rounded-xl border-border/70 bg-background pl-9 pr-3 sm:w-60"
								value={searchValue}
								onChange={event => onSearchChange(event.target.value)}
								autoFocus
							/>
						</div>
					)}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-9 w-9 rounded-full"
						onClick={onToggleSearch}
						aria-label={isSearchOpen ? 'Close search' : 'Open search'}
					>
						{isSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="h-9 w-9 rounded-full">
								<MoreVertical className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={onTogglePin}>
								<Pin className="h-4 w-4" />
								{isPinned ? 'Unpin' : 'Pin'}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onToggleMute}>
								<BellOff className="h-4 w-4" />
								{isMuted ? 'Unmute' : 'Mute'}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onToggleArchive}>
								<Archive className="h-4 w-4" />
								{isArchived ? 'Unarchive' : 'Archive'}
							</DropdownMenuItem>
							<DropdownMenuItem variant="destructive" onClick={onDelete}>
								<Trash2 className="h-4 w-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</div>
	);
}
