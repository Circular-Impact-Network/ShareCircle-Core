import { BellOff, MoreVertical, Pin, Search, Trash2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
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
	onTogglePin: () => void;
	onToggleMute: () => void;
	onToggleArchive: () => void;
	onDelete: () => void;
	onToggleSearch: () => void;
	onSearchChange: (value: string) => void;
};

export function ChatHeader({
	user,
	isOnline,
	isTyping,
	isPinned,
	isMuted,
	isSearchOpen,
	searchValue,
	onTogglePin,
	onToggleMute,
	onDelete,
	onToggleSearch,
	onSearchChange,
}: ChatHeaderProps) {
	return (
		<div className="border-b border-border bg-card p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<Avatar className="h-10 w-10">
						<AvatarImage src={user?.image || undefined} alt={user?.name || 'User'} />
						<AvatarFallback className="bg-primary text-primary-foreground">
							{user?.name?.[0]?.toUpperCase() || '?'}
						</AvatarFallback>
					</Avatar>
					<div>
						<p className="font-semibold text-foreground">{user?.name || 'Unknown'}</p>
						<p className="text-xs text-muted-foreground">
							{isTyping ? 'typing...' : isOnline ? 'online' : 'offline'}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2">
					{isSearchOpen && (
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								placeholder="Search in chat..."
								className="h-9 w-40 pl-9 pr-3 sm:w-56"
								value={searchValue}
								onChange={event => onSearchChange(event.target.value)}
								autoFocus
							/>
						</div>
					)}
					<button
						type="button"
						onClick={onToggleSearch}
						className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
						aria-label={isSearchOpen ? 'Close search' : 'Open search'}
					>
						{isSearchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
					</button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<span className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
								<MoreVertical className="h-4 w-4" />
							</span>
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
							{/* <DropdownMenuItem onClick={onToggleArchive}>
								<Archive className="h-4 w-4" />
								{isArchived ? 'Unarchive' : 'Archive'}
							</DropdownMenuItem> */}
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
