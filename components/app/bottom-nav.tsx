'use client';

import { Home, Search, LayoutGrid, MessageSquare, Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useGetUnreadNotificationCountQuery } from '@/lib/redux/api/notificationsApi';
import { useGetUnreadMessageCountQuery } from '@/lib/redux/api/messagesApi';

const tabs = [
	{ id: 'home', label: 'Home', icon: Home, href: '/home' },
	{ id: 'browse', label: 'Browse', icon: Search, href: '/browse' },
	{ id: 'circles', label: 'Circles', icon: LayoutGrid, href: '/circles' },
	{ id: 'messages', label: 'Messages', icon: MessageSquare, href: '/messages' },
	{ id: 'notifications', label: 'Alerts', icon: Bell, href: '/notifications' },
] as const;

export function BottomNav() {
	const pathname = usePathname();
	const { data: notificationsData } = useGetUnreadNotificationCountQuery();
	const { data: messagesData } = useGetUnreadMessageCountQuery();

	const unread: Record<string, number> = {
		messages: messagesData?.unreadCount ?? 0,
		notifications: notificationsData?.unreadCount ?? 0,
	};

	const isActive = (href: string) => {
		if (href === '/home') return pathname === '/home' || pathname === '/';
		return pathname.startsWith(href);
	};

	return (
		<nav
			className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-border/50 bg-background/95 backdrop-blur-sm pb-safe-bottom"
			aria-label="Bottom navigation"
		>
			<div className="flex h-16 items-stretch">
				{tabs.map(tab => {
					const Icon = tab.icon;
					const active = isActive(tab.href);
					const count = unread[tab.id] ?? 0;
					return (
						<Link
							key={tab.id}
							href={tab.href}
							className={cn(
								'relative flex flex-1 flex-col items-center justify-center gap-1 transition-colors',
								active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
							)}
							aria-label={tab.label}
							aria-current={active ? 'page' : undefined}
						>
							{count > 0 && (
								<span className="absolute right-[calc(50%-10px)] top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white">
									{count > 99 ? '99+' : count}
								</span>
							)}
							<Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
							<span className={cn('text-[10px] leading-none', active ? 'font-semibold' : 'font-medium')}>
								{tab.label}
							</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
