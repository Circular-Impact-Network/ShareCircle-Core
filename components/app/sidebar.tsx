'use client';

import { Home, Search, LayoutGrid, MessageSquare, LogOut, Plus, Settings, Bell, History } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAppSelector } from '@/lib/redux/hooks';
import { selectUserImage, selectUserName, selectUserEmail } from '@/lib/redux/selectors/userSelectors';
import { useGetUnreadNotificationCountQuery } from '@/lib/redux/api/notificationsApi';
import { useGetUnreadMessageCountQuery } from '@/lib/redux/api/messagesApi';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const navItems = [
	{ id: 'home', label: 'Home', icon: Home, href: '/home' },
	{ id: 'browse', label: 'Browse Items', icon: Search, href: '/browse' },
	{ id: 'circles', label: 'Circles', icon: LayoutGrid, href: '/circles' },
	{ id: 'listings', label: 'My Listings', icon: Plus, href: '/listings' },
	{ id: 'activity', label: 'My Activity', icon: History, href: '/activity' },
	{ id: 'messages', label: 'Messages', icon: MessageSquare, href: '/messages' },
	{ id: 'notifications', label: 'Notifications', icon: Bell, href: '/notifications' },
	{ id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
];

export function Sidebar() {
	const pathname = usePathname();

	const userImage = useAppSelector(selectUserImage);
	const userName = useAppSelector(selectUserName);
	const userEmail = useAppSelector(selectUserEmail);

	const { data: notificationsData } = useGetUnreadNotificationCountQuery();
	const { data: messagesData } = useGetUnreadMessageCountQuery();

	const totalNotificationUnread = notificationsData?.unreadCount || 0;
	const totalMessageUnread = messagesData?.unreadCount || 0;

	const isActive = (href: string) => {
		if (href === '/home') return pathname === '/home' || pathname === '/';
		return pathname.startsWith(href);
	};

	const handleLogout = async () => {
		if (typeof navigator !== 'undefined' && navigator.serviceWorker.controller) {
			navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_RUNTIME_CACHES' });
		}
		await signOut({ callbackUrl: '/landing' });
	};

	const getInitials = (name: string) => {
		if (!name) return 'U';
		return name
			.split(' ')
			.map(n => n[0])
			.join('')
			.toUpperCase()
			.slice(0, 2);
	};

	const isActive = (href: string) => {
		// Handle exact match for home, prefix match for others
		if (href === '/home') {
			return pathname === '/home' || pathname === '/';
		}
		return pathname.startsWith(href);
	};

	const handleNavClick = () => {
		// Close mobile sidebar when navigating
		dispatch(setMobileSidebarOpen(false));
	};

	const sidebarContent = (
		<div className="flex h-full flex-col overflow-hidden">
			{/* Logo */}
			<div className="flex items-center justify-center gap-3 border-b border-border px-3 py-3">
				<Link href="/home" className="flex-1 flex items-center gap-2.5" onClick={handleNavClick}>
					<div className="h-9 w-9 flex-shrink-0 rounded-full bg-white shadow-sm overflow-hidden">
						<Image
							src="/share-circle-icon-square.png"
							alt="ShareCircle"
							width={36}
							height={36}
							className="h-9 w-9 object-contain"
							priority
						/>
					</div>
					<span className="text-sm font-semibold text-foreground leading-tight">ShareCircle</span>
				</Link>
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8 lg:hidden flex-shrink-0"
					onClick={() => dispatch(setMobileSidebarOpen(false))}
				>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{/* Navigation */}
			<ScrollArea className="flex-1">
				<nav className="space-y-1.5 p-3">
					{navItems.map(item => {
						const Icon = item.icon;
						const active = isActive(item.href);
						// Determine unread count based on nav item
						let unreadCount = 0;
						if (item.id === 'notifications') {
							unreadCount = totalNotificationUnread;
						} else if (item.id === 'messages') {
							unreadCount = totalMessageUnread;
						}
						return (
							<Link
								key={item.id}
								href={item.href}
								onClick={handleNavClick}
								className={cn(
									'flex w-full items-center justify-start gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors',
									active
										? 'bg-primary text-primary-foreground shadow-sm'
										: 'text-foreground hover:bg-muted/80',
								)}
							>
								<Icon className="h-4 w-4" />
								<span className="flex-1">{item.label}</span>
								{unreadCount > 0 && (
									<Badge
										variant={active ? 'secondary' : 'destructive'}
										className="h-5 min-w-[20px] px-1.5 text-[10px]"
									>
										{unreadCount > 99 ? '99+' : unreadCount}
									</Badge>
								)}
							</Link>
						);
					})}
				</nav>
			</ScrollArea>

			{/* User Profile Section */}
			{(userName || userEmail) && (
				<div className="border-t border-border px-4 py-2.5">
					<div className="flex items-center gap-2.5">
						<Avatar className="h-9 w-9 bg-primary">
							<AvatarImage src={userImage || ''} />
							<AvatarFallback className="bg-primary text-primary-foreground font-semibold leading-[1.6rem]">
								{getInitials(userName || userEmail || 'U')}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<p className="text-sm font-medium truncate">{userName || userEmail?.split('@')[0]}</p>
							<p className="text-xs text-muted-foreground truncate">{userEmail}</p>
						</div>
						<Button variant="outline" size="icon" className="h-8 w-8 bg-transparent" onClick={handleLogout}>
							<LogOut className="h-4 w-4" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);

	return (
		<>
			{/* Desktop Sidebar - Fixed position */}
			<aside className="fixed left-0 top-0 z-40 hidden h-[100dvh] w-60 flex-col border-r border-border bg-card/95 backdrop-blur lg:flex">
				{sidebarContent}
			</aside>

			{/* Mobile Overlay */}
			{isMobileSidebarOpen && (
				<div
					className="fixed inset-0 bg-black/50 z-40 lg:hidden"
					onClick={() => dispatch(setMobileSidebarOpen(false))}
				/>
			)}

			{/* Mobile Sidebar */}
			<div
				className={`fixed inset-y-0 left-0 z-50 flex min-h-[100dvh] max-h-[100dvh] w-60 flex-col border-r border-border bg-card transition-transform duration-300 lg:hidden ${
					isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
				}`}
			>
				{sidebarContent}
			</div>
		</>
	);
}
