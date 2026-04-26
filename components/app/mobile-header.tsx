'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LogOut, Settings, List, History } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppSelector } from '@/lib/redux/hooks';
import { selectUserImage, selectUserName, selectUserEmail } from '@/lib/redux/selectors/userSelectors';

function getInitials(name: string) {
	if (!name) return 'U';
	return name
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);
}

export function MobileHeader() {
	const userImage = useAppSelector(selectUserImage);
	const userName = useAppSelector(selectUserName);
	const userEmail = useAppSelector(selectUserEmail);
	const displayName = userName || userEmail?.split('@')[0] || 'User';

	const handleLogout = async () => {
		if (typeof navigator !== 'undefined' && navigator.serviceWorker.controller) {
			navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_RUNTIME_CACHES' });
		}
		await signOut({ callbackUrl: '/landing' });
	};

	return (
		<header className="fixed left-0 right-0 top-0 z-30 flex h-12 items-center justify-between border-b border-border/50 bg-background/95 backdrop-blur-sm px-3 lg:hidden">
			<Link href="/home" className="flex items-center gap-2">
				<div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white shadow-sm">
					<Image
						src="/share-circle-icon-square.png"
						alt="ShareCircle"
						width={32}
						height={32}
						className="h-8 w-8 object-contain"
						priority
					/>
				</div>
				<span className="text-sm font-semibold text-foreground">ShareCircle</span>
			</Link>

			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="flex h-9 w-9 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label="Account menu"
					>
						<Avatar className="h-8 w-8">
							<AvatarImage src={userImage || ''} />
							<AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
								{getInitials(displayName)}
							</AvatarFallback>
						</Avatar>
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-48">
					<DropdownMenuItem asChild>
						<Link href="/listings" className="flex items-center gap-2">
							<List className="h-4 w-4" />
							My Listings
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link href="/activity" className="flex items-center gap-2">
							<History className="h-4 w-4" />
							My Activity
						</Link>
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<Link href="/settings" className="flex items-center gap-2">
							<Settings className="h-4 w-4" />
							Settings
						</Link>
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={handleLogout}
						className="flex items-center gap-2 text-destructive focus:text-destructive"
					>
						<LogOut className="h-4 w-4" />
						Logout
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</header>
	);
}
