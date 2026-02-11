'use client';

import { Home, Search, LayoutGrid, MessageSquare, LogOut, Plus, Settings, X, Bell, History, HandHelping } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAppDispatch, useAppSelector } from '@/lib/redux/hooks';
import { setMobileSidebarOpen } from '@/lib/redux/slices/uiSlice';
import { selectUserImage, selectUserName, selectUserEmail } from '@/lib/redux/selectors/userSelectors';
import { useGetNotificationsQuery } from '@/lib/redux/api/notificationsApi';
import { useGetUnreadMessageCountQuery } from '@/lib/redux/api/messagesApi';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

const navItems = [
	{ id: 'home', label: 'Home', icon: Home, href: '/home' },
	{ id: 'browse', label: 'Browse Items', icon: Search, href: '/browse' },
	{ id: 'requests', label: 'Item Requests', icon: HandHelping, href: '/requests' },
	{ id: 'circles', label: 'Circles', icon: LayoutGrid, href: '/circles' },
	{ id: 'listings', label: 'My Listings', icon: Plus, href: '/listings' },
	{ id: 'activity', label: 'My Activity', icon: History, href: '/activity' },
	{ id: 'messages', label: 'Messages', icon: MessageSquare, href: '/messages' },
	{ id: 'notifications', label: 'Notifications', icon: Bell, href: '/notifications' },
	{ id: 'settings', label: 'Settings', icon: Settings, href: '/settings' },
];

export function Sidebar() {
	const pathname = usePathname();
	const dispatch = useAppDispatch();
	const isMobileSidebarOpen = useAppSelector(state => state.ui.isMobileSidebarOpen);

	// Redux selectors for user data
	const userImage = useAppSelector(selectUserImage);
	const userName = useAppSelector(selectUserName);
	const userEmail = useAppSelector(selectUserEmail);

	// Get notification counts - fetch minimal data just to get counts
	// Realtime updates are handled by NotificationsProvider which invalidates queries
	const { data: notificationsData } = useGetNotificationsQuery({ limit: 1 });
	
	// Get unread message count
	// Realtime updates are handled by NotificationsProvider which invalidates queries
	const { data: messagesData } = useGetUnreadMessageCountQuery();
	
	// Use total unread count from API
	const totalNotificationUnread = notificationsData?.unreadCount || 0;
	const totalMessageUnread = messagesData?.unreadCount || 0;

	const handleLogout = async () => {
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
			<div className="border-b border-border px-4 py-3 flex items-center justify-between gap-3">
				<Link href="/home" className="flex items-center gap-3" onClick={handleNavClick}>
					<div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
						<span className="text-primary-foreground font-bold text-sm">SC</span>
					</div>
					<span className="font-display font-semibold text-lg">ShareCircle</span>
				</Link>
				<Button
					variant="ghost"
					size="icon"
					className="lg:hidden"
					onClick={() => dispatch(setMobileSidebarOpen(false))}
				>
					<X className="h-5 w-5" />
				</Button>
			</div>

			{/* Navigation */}
			<ScrollArea className="flex-1">
				<nav className="space-y-2 p-4">
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
									'flex w-full items-center justify-start gap-3 px-4 py-3 text-left font-medium transition-colors rounded-md',
									active
										? 'bg-primary text-primary-foreground shadow'
										: 'text-foreground hover:bg-muted',
								)}
							>
								<Icon className="h-5 w-5" />
								<span className="flex-1">{item.label}</span>
								{unreadCount > 0 && (
									<Badge
										variant={active ? 'secondary' : 'destructive'}
										className="h-5 min-w-[20px] px-1.5 text-xs"
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
				<div className="border-t border-border px-4 py-3">
					<div className="flex items-center gap-3">
						<Avatar className="w-10 h-10 bg-primary">
							<AvatarImage src={userImage || ''} />
							<AvatarFallback className="bg-primary text-primary-foreground font-semibold leading-[1.6rem]">
								{getInitials(userName || userEmail || 'U')}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<p className="text-sm font-medium truncate">{userName || userEmail?.split('@')[0]}</p>
							<p className="text-xs text-muted-foreground truncate">{userEmail}</p>
						</div>
						<Button variant="outline" className="gap-2 bg-transparent" onClick={handleLogout}>
							<LogOut className="w-4 h-4" />
						</Button>
					</div>
				</div>
			)}
		</div>
	);

	return (
		<>
			{/* Desktop Sidebar - Fixed position */}
			<aside className="hidden lg:flex fixed left-0 top-0 w-64 h-[100dvh] border-r border-border bg-card flex-col z-40">
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
				className={`fixed inset-y-0 left-0 w-64 border-r border-border bg-card flex flex-col min-h-[100dvh] max-h-[100dvh] z-50 transform transition-transform duration-300 lg:hidden ${
					isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
				}`}
			>
				{sidebarContent}
			</div>
		</>
	);
}
