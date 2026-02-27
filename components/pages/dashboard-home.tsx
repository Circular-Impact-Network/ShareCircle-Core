'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Bell, Clock, MessageCircle, Plus, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/ui/page';
import { useGetUserQuery } from '@/lib/redux/api/userApi';
import { useGetNotificationsQuery } from '@/lib/redux/api/notificationsApi';
import { useGetUnreadMessageCountQuery } from '@/lib/redux/api/messagesApi';
import { useGetBorrowRequestsQuery, useGetItemRequestsQuery } from '@/lib/redux/api/borrowApi';
import { useGetCirclesQuery } from '@/lib/redux/api/circlesApi';
import type { ChatThread as ChatThreadType } from '@/components/chat/types';

export function DashboardHome() {
	const router = useRouter();
	const { data: session } = useSession();
	const { data: user } = useGetUserQuery();
	const [dashboardSearch, setDashboardSearch] = useState('');
	const [recentThreads, setRecentThreads] = useState<ChatThreadType[]>([]);
	const [isRecentThreadsLoading, setIsRecentThreadsLoading] = useState(true);
	const { data: notificationsData, isLoading: isNotificationsLoading } = useGetNotificationsQuery({ limit: 5 });
	const { data: unreadMessagesData, isLoading: isUnreadMessagesLoading } = useGetUnreadMessageCountQuery();
	const { data: incomingRequests = [], isLoading: isIncomingLoading } = useGetBorrowRequestsQuery({
		type: 'incoming',
	});
	const { data: itemRequests = [], isLoading: isItemRequestsLoading } = useGetItemRequestsQuery();
	const { data: circles = [], isLoading: isCirclesLoading } = useGetCirclesQuery();

	const userName = user?.name || session?.user?.name || 'there';
	const newUserWindowMs = 2 * 60 * 60 * 1000;
	const userCreatedAt = user?.createdAt ? new Date(user.createdAt) : null;
	const isNewUser = userCreatedAt ? Date.now() - userCreatedAt.getTime() < newUserWindowMs : false;
	const welcomeTitle = isNewUser ? `Welcome, ${userName}!` : `Welcome back, ${userName}!`;
	const unreadNotifications = notificationsData?.unreadCount ?? 0;
	const unreadMessages = unreadMessagesData?.unreadCount ?? 0;
	
	// Memoize filtered arrays to prevent recalculation on every render
	const pendingRequests = useMemo(
		() => incomingRequests.filter(request => request.status === 'PENDING'),
		[incomingRequests]
	);
	const openItemRequests = useMemo(
		() => itemRequests.filter(request => request.status === 'OPEN'),
		[itemRequests]
	);
	const recentNotifications = useMemo(() => notificationsData?.notifications?.slice(0, 3) ?? [], [notificationsData]);
	const messageNotifications = useMemo(
		() =>
			(notificationsData?.notifications ?? [])
				.filter(notification => notification.type === 'NEW_MESSAGE')
				.slice(0, 3),
		[notificationsData]
	);

	useEffect(() => {
		let isMounted = true;

		async function loadRecentThreads() {
			setIsRecentThreadsLoading(true);
			try {
				const response = await fetch('/api/messages/threads');
				if (!response.ok) {
					return;
				}
				const data = (await response.json()) as ChatThreadType[];
				if (isMounted) {
					setRecentThreads(data.slice(0, 3));
				}
			} catch (error) {
				console.error('Failed to load recent threads:', error);
			} finally {
				if (isMounted) {
					setIsRecentThreadsLoading(false);
				}
			}
		}

		loadRecentThreads();
		return () => {
			isMounted = false;
		};
	}, [unreadMessages]);

	const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const query = dashboardSearch.trim();
		if (!query) {
			router.push('/browse');
			return;
		}
		router.push(`/browse?q=${encodeURIComponent(query)}`);
	};

	return (
		<div className="flex-1 bg-background">
			<PageShell className="space-y-5 sm:space-y-6">
				<Card className="border-none bg-gradient-to-r from-primary/20 via-primary/10 to-secondary/20 text-primary-foreground shadow-xl">
					<CardHeader className="space-y-1.5 pb-4">
						<CardTitle className="text-2xl font-semibold lg:text-3xl">{welcomeTitle}</CardTitle>
						<CardDescription className="text-sm text-primary-foreground/80 sm:text-base">
							Share what you have, borrow what you need
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-wrap gap-2.5 pt-0">
						<Button variant="secondary" size="sm" className="gap-2" asChild>
							<Link href="/listings">
								<Plus className="h-4 w-4" />
								Create listing
							</Link>
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="bg-white/10 text-white hover:bg-white/20"
							asChild
						>
							<Link href="/browse">
								Browse items
							</Link>
						</Button>
					</CardContent>
				</Card>

				<form onSubmit={handleSearchSubmit}>
					<div className="flex w-full items-center gap-2">
						<Input
							value={dashboardSearch}
							onChange={event => setDashboardSearch(event.target.value)}
							placeholder="Search for items across all circles..."
							className="h-10"
						/>
						<Button type="submit" size="icon" className="h-10 w-10 shrink-0">
							<Search className="h-4 w-4" />
						</Button>
					</div>
				</form>

				<div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
					<Card className="flex flex-col border-border/60">
						<CardHeader className="space-y-1 pb-2">
							<div className="flex items-center justify-between gap-2">
								<CardTitle className="text-base sm:text-lg">Open requests ({pendingRequests.length})</CardTitle>
								<Clock className="h-4 w-4 text-primary" />
							</div>
							<CardDescription className="text-xs sm:text-sm">Your pending incoming borrow requests</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-1 flex-col gap-2.5 pt-0">
							{isIncomingLoading ? (
								<p className="text-sm text-muted-foreground">Loading requests...</p>
							) : pendingRequests.length === 0 ? (
								<p className="text-sm text-muted-foreground">No pending requests right now.</p>
							) : (
								pendingRequests.slice(0, 3).map(request => (
									<div key={request.id} className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
										<p className="text-sm font-medium text-foreground">{request.item.name}</p>
										<p className="text-xs text-muted-foreground">
											From {request.requester?.name || 'Unknown'} -{' '}
											{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
										</p>
									</div>
								))
							)}
							<div className="mt-auto flex justify-end border-t border-border/60 pt-3">
								<Button asChild variant="ghost" size="sm" className="h-8 px-2 text-sm">
									<Link href="/notifications?tab=requests">View all requests</Link>
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card className="flex flex-col border-border/60">
						<CardHeader className="space-y-1 pb-2">
							<div className="flex items-center justify-between gap-2">
								<CardTitle className="text-base sm:text-lg">Notifications ({unreadNotifications})</CardTitle>
								<Bell className="h-4 w-4 text-primary" />
							</div>
							<CardDescription className="text-xs sm:text-sm">Recent alerts for your account</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-1 flex-col gap-2.5 pt-0">
							{isNotificationsLoading ? (
								<p className="text-sm text-muted-foreground">Loading notifications...</p>
							) : recentNotifications.length === 0 ? (
								<p className="text-sm text-muted-foreground">No notifications yet.</p>
							) : (
								recentNotifications.map(notification => (
									<div
										key={notification.id}
										className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
									>
										<p className="text-sm font-medium text-foreground">{notification.title}</p>
										<p className="line-clamp-1 text-xs text-muted-foreground">{notification.body}</p>
									</div>
								))
							)}
							<div className="mt-auto flex justify-end border-t border-border/60 pt-3">
								<Button asChild variant="ghost" size="sm" className="h-8 px-2 text-sm">
									<Link href="/notifications">View all notifications</Link>
								</Button>
							</div>
						</CardContent>
					</Card>

					<Card className="flex flex-col border-border/60">
						<CardHeader className="space-y-1 pb-2">
							<div className="flex items-center justify-between gap-2">
								<CardTitle className="text-base sm:text-lg">Messages ({unreadMessages})</CardTitle>
								<MessageCircle className="h-4 w-4 text-primary" />
							</div>
							<CardDescription className="text-xs sm:text-sm">Recent unread message activity</CardDescription>
						</CardHeader>
						<CardContent className="flex flex-1 flex-col gap-2.5 pt-0">
							{isUnreadMessagesLoading || isRecentThreadsLoading ? (
								<p className="text-sm text-muted-foreground">Loading conversations...</p>
							) : recentThreads.length > 0 ? (
								recentThreads.map(thread => {
									const otherUser = thread.participants[0];
									const hasUnread = thread.unreadCount > 0;
									return (
										<Link
											key={thread.id}
											href={`/messages/${thread.id}`}
											className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 transition-colors hover:border-primary/30 hover:bg-muted/40"
										>
											<div className="flex items-center justify-between gap-3">
												<p className="line-clamp-1 text-sm font-medium text-foreground">
													{otherUser?.name || 'Unknown'}
												</p>
												<span className="shrink-0 text-[11px] text-muted-foreground">
													{thread.lastMessageAt
														? formatDistanceToNow(new Date(thread.lastMessageAt), { addSuffix: true })
														: 'New'}
												</span>
											</div>
											<p className="line-clamp-1 text-xs text-muted-foreground">
												{thread.lastMessage?.body || 'Start a conversation'}
											</p>
											{hasUnread ? (
												<p className="mt-1 text-[11px] font-medium text-primary">
													{thread.unreadCount} unread {thread.unreadCount === 1 ? 'message' : 'messages'}
												</p>
											) : null}
										</Link>
									);
								})
							) : messageNotifications.length > 0 ? (
								messageNotifications.map(notification => (
									<div
										key={notification.id}
										className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2"
									>
										<p className="text-sm font-medium text-foreground">{notification.title}</p>
										<p className="line-clamp-1 text-xs text-muted-foreground">{notification.body}</p>
									</div>
								))
							) : (
								<div className="space-y-1 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
									<p className="text-sm font-medium text-foreground">No recent conversations</p>
									<p className="text-xs text-muted-foreground">Your latest chats will appear here.</p>
								</div>
							)}
							<div className="mt-auto flex justify-end border-t border-border/60 pt-3">
								<Button asChild variant="ghost" size="sm" className="h-8 px-2 text-sm">
									<Link href="/messages">View all messages</Link>
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>

				<Card className="border-border/60">
					<CardHeader className="space-y-1 pb-3">
						<CardTitle>Open item requests</CardTitle>
						<CardDescription className="text-sm">Requests from circles that still need items</CardDescription>
					</CardHeader>
					<CardContent className="space-y-2.5 pt-0">
						{isItemRequestsLoading ? (
							<p className="text-sm text-muted-foreground">Loading item requests...</p>
						) : openItemRequests.length === 0 ? (
							<p className="text-sm text-muted-foreground">No open item requests right now.</p>
						) : (
							openItemRequests.slice(0, 3).map(request => (
								<div key={request.id} className="rounded-md border border-border/60 px-3.5 py-3">
									<p className="text-sm font-medium text-foreground">{request.title}</p>
									<p className="mt-1 text-xs text-muted-foreground">
										From {request.requester?.name || 'Unknown'} in {request.circle?.name || 'your circle'} -{' '}
										{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
									</p>
								</div>
							))
						)}
						<div className="flex justify-end border-t border-border/60 pt-3">
							<Button asChild variant="ghost" size="sm" className="h-8 px-2 text-sm">
								<Link href="/requests">See all requests</Link>
							</Button>
						</div>
					</CardContent>
				</Card>

				<section className="space-y-3.5 sm:space-y-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<div className="space-y-1">
							<h2 className="text-lg font-semibold tracking-tight sm:text-xl">My circles</h2>
							<p className="text-sm text-muted-foreground">Your sharing communities</p>
						</div>
						<Button asChild size="sm">
							<Link href="/circles" className="gap-2">
								<Plus className="h-4 w-4" />
								Join Circle
							</Link>
						</Button>
					</div>

					{isCirclesLoading ? (
						<Card className="border-border/60">
							<CardContent className="py-8 text-center text-sm text-muted-foreground">Loading circles...</CardContent>
						</Card>
					) : circles.length === 0 ? (
						<Card className="border-border/60">
							<CardContent className="py-8 text-center">
								<p className="text-sm text-muted-foreground">No circles yet. Join or create one to get started.</p>
							</CardContent>
						</Card>
					) : (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
							{circles.slice(0, 6).map(circle => (
								<Link key={circle.id} href={`/circles/${circle.id}`} className="block">
									<Card className="h-full border-border/60 transition-colors hover:border-primary/40">
										<CardHeader className="space-y-1 pb-1.5">
											<div className="flex items-start justify-between gap-2">
												<CardTitle className="line-clamp-1 text-base">{circle.name}</CardTitle>
												<Users className="h-4 w-4 shrink-0 text-muted-foreground" />
											</div>
											<CardDescription className="line-clamp-2">
												{circle.description || 'No description'}
											</CardDescription>
										</CardHeader>
										<CardContent className="pt-0">
											<p className="text-xs text-muted-foreground">
												{circle.membersCount} {circle.membersCount === 1 ? 'member' : 'members'} -{' '}
												{circle.userRole === 'ADMIN' ? 'Admin' : 'Member'}
											</p>
										</CardContent>
									</Card>
								</Link>
							))}
						</div>
					)}
				</section>
			</PageShell>
		</div>
	);
}
