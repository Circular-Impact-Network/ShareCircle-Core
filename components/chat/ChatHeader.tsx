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
	onBack,
	onTogglePin,
	onToggleMute,
	onToggleArchive,
	onDelete,
	onToggleSearch,
	onSearchChange,
	onNewItem,
}: ChatHeaderProps) {
	return (
		<div className="flex-shrink-0 border-b border-border/70 bg-card/95 px-3 py-2.5">
			<div className="flex items-center gap-2">
				{/* Back button — only in mobile thread view */}
				{onBack && (
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-9 w-9 shrink-0 rounded-full"
						onClick={onBack}
						aria-label="Back to messages"
					>
						<ArrowLeft className="h-5 w-5" />
					</Button>
				)}

				{/* User info */}
				<div className="flex min-w-0 flex-1 items-center gap-2.5">
					<Avatar className="h-9 w-9 shrink-0">
						<AvatarImage src={user?.image || undefined} alt={user?.name || 'User'} />
						<AvatarFallback className="bg-primary text-primary-foreground text-sm">
							{user?.name?.[0]?.toUpperCase() || '?'}
						</AvatarFallback>
					</Avatar>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-semibold leading-tight text-foreground">
							{user?.name || 'Unknown'}
						</p>
						<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
							<span
								className={`h-1.5 w-1.5 shrink-0 rounded-full ${
									isTyping ? 'bg-amber-500' : isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
								}`}
							/>
							<span>{isTyping ? 'typing…' : isOnline ? 'online' : 'offline'}</span>
							{isArchived && <span>· Archived</span>}
						</div>
					</div>
				</div>

				{/* Actions */}
				<div className="flex shrink-0 items-center gap-1">
					{onNewItem && !isSearchOpen && (
						<>
							{/* Mobile: icon-only */}
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="h-9 w-9 shrink-0 rounded-full sm:hidden"
								onClick={onNewItem}
								aria-label="Add item"
							>
								<Plus className="h-4 w-4" />
							</Button>
							{/* Desktop: icon + label */}
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="hidden h-8 gap-1.5 rounded-full text-xs sm:flex"
								onClick={onNewItem}
							>
								<Plus className="h-3.5 w-3.5" />
								Add Item
							</Button>
						</>
					)}
					{isSearchOpen && (
						<div className="relative flex items-center">
							<Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search in chat…"
								className="h-8 w-36 rounded-xl border-border/70 bg-background pl-9 pr-3 text-xs sm:w-52"
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
