import { BellOff, MoreVertical, Pin, Archive, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ChatUser } from './types';

type ChatHeaderProps = {
	user: ChatUser | null;
	isOnline: boolean;
	isTyping: boolean;
	isPinned: boolean;
	isMuted: boolean;
	isArchived: boolean;
	onTogglePin: () => void;
	onToggleMute: () => void;
	onToggleArchive: () => void;
	onDelete: () => void;
};

export function ChatHeader({
	user,
	isOnline,
	isTyping,
	isPinned,
	isMuted,
	isArchived,
	onTogglePin,
	onToggleMute,
	onToggleArchive,
	onDelete,
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
	);
}
