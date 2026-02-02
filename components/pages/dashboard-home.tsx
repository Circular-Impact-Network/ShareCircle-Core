'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
	Bell,
	Clock,
	HandshakeIcon,
	MessageCircle,
	Plus,
	Search,
	TrendingUp,
	Users,
} from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageShell } from '@/components/ui/page';
import { useGetUserQuery } from '@/lib/redux/api/userApi';
import { useGetNotificationsQuery } from '@/lib/redux/api/notificationsApi';
import { useGetUnreadMessageCountQuery } from '@/lib/redux/api/messagesApi';
import {
	useGetBorrowRequestsQuery,
	useGetItemRequestsQuery,
	useGetTransactionsQuery,
} from '@/lib/redux/api/borrowApi';
import { useGetAllItemsQuery } from '@/lib/redux/api/itemsApi';

type CircleSummary = {
	id: string;
	name: string;
	membersCount: number;
};

export function DashboardHome() {
	const { data: session } = useSession();
	const { data: user } = useGetUserQuery();
	const { data: notificationsData, isLoading: isNotificationsLoading } = useGetNotificationsQuery({ limit: 5 });
	const { data: unreadMessagesData, isLoading: isUnreadMessagesLoading } = useGetUnreadMessageCountQuery();
	const { data: incomingRequests = [], isLoading: isIncomingLoading } = useGetBorrowRequestsQuery({
		type: 'incoming',
	});
	const { data: itemRequests = [], isLoading: isItemRequestsLoading } = useGetItemRequestsQuery();
	const { data: borrowerTransactions = [], isLoading: isBorrowerLoading } = useGetTransactionsQuery({
		role: 'borrower',
	});
	const { data: ownerTransactions = [], isLoading: isOwnerLoading } = useGetTransactionsQuery({
		role: 'owner',
	});
	const { data: items = [], isLoading: isItemsLoading } = useGetAllItemsQuery();
	const [circles, setCircles] = useState<CircleSummary[]>([]);
	const [isCirclesLoading, setIsCirclesLoading] = useState(true);

	useEffect(() => {
		let isActive = true;

		const fetchCircles = async () => {
			try {
				setIsCirclesLoading(true);
				const response = await fetch('/api/circles');
				if (!response.ok) {
					throw new Error('Failed to fetch circles');
				}
				const data = (await response.json()) as CircleSummary[];
				if (isActive) {
					setCircles(Array.isArray(data) ? data : []);
				}
			} catch (error) {
				console.error('Error fetching circles:', error);
				if (isActive) {
					setCircles([]);
				}
			} finally {
				if (isActive) {
					setIsCirclesLoading(false);
				}
			}
		};

		fetchCircles();
		return () => {
			isActive = false;
		};
	}, []);

	const userName = user?.name || session?.user?.name || 'there';
	const unreadNotifications = notificationsData?.unreadCount ?? 0;
	const unreadMessages = unreadMessagesData?.unreadCount ?? 0;
	const pendingRequests = incomingRequests.filter(request => request.status === 'PENDING');
	const openItemRequests = itemRequests.filter(request => request.status === 'OPEN');
	const myItems = items.filter(item => item.isOwner);
	const activeBorrower = borrowerTransactions.filter(
		transaction => transaction.status === 'ACTIVE' || transaction.status === 'RETURN_PENDING',
	);
	const activeOwner = ownerTransactions.filter(
		transaction => transaction.status === 'ACTIVE' || transaction.status === 'RETURN_PENDING',
	);

	const recentTransactions = useMemo(() => {
		const withRole = [
			...borrowerTransactions.map(transaction => ({ ...transaction, role: 'borrower' as const })),
			...ownerTransactions.map(transaction => ({ ...transaction, role: 'owner' as const })),
		];

		return withRole
			.sort((a, b) => {
				const aDate = new Date(a.returnedAt || a.borrowedAt || a.createdAt).getTime();
				const bDate = new Date(b.returnedAt || b.borrowedAt || b.createdAt).getTime();
				return bDate - aDate;
			})
			.slice(0, 5);
	}, [borrowerTransactions, ownerTransactions]);

	const latestAlerts = notificationsData?.notifications?.slice(0, 3) ?? [];

	return (
		<div className="flex-1 bg-background">
			<PageShell className="space-y-8">
				<Card className="border-none bg-gradient-to-r from-primary/20 via-primary/10 to-secondary/20 text-primary-foreground shadow-2xl">
					<CardHeader className="space-y-2">
						<CardTitle className="text-3xl font-bold lg:text-4xl">Welcome back, {userName}!</CardTitle>
						<CardDescription className="text-base text-primary-foreground/80">
							Share what you have, borrow what you need
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-wrap gap-3">
						<Button variant="secondary" className="gap-2" asChild>
							<Link href="/listings">
								<Plus className="h-4 w-4" />
								Create listing
							</Link>
						</Button>
						<Button
							variant="outline"
							className="bg-white/10 text-white hover:bg-white/20"
							asChild
						>
							<Link href="/browse">
								Browse items
							</Link>
						</Button>
					</CardContent>
				</Card>

				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardDescription>Unread notifications</CardDescription>
							<Bell className="h-5 w-5 text-primary" />
						</CardHeader>
						<CardContent>
							<div className={`text-3xl font-bold ${isNotificationsLoading ? 'text-muted-foreground' : ''}`}>
								{isNotificationsLoading ? '—' : unreadNotifications}
							</div>
							<Button asChild variant="link" className="h-auto p-0 text-sm">
								<Link href="/notifications">View alerts</Link>
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardDescription>Unread messages</CardDescription>
							<MessageCircle className="h-5 w-5 text-primary" />
						</CardHeader>
						<CardContent>
							<div className={`text-3xl font-bold ${isUnreadMessagesLoading ? 'text-muted-foreground' : ''}`}>
								{isUnreadMessagesLoading ? '—' : unreadMessages}
							</div>
							<Button asChild variant="link" className="h-auto p-0 text-sm">
								<Link href="/messages">Open inbox</Link>
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardDescription>Pending requests</CardDescription>
							<Clock className="h-5 w-5 text-primary" />
						</CardHeader>
						<CardContent>
							<div className={`text-3xl font-bold ${isIncomingLoading ? 'text-muted-foreground' : ''}`}>
								{isIncomingLoading ? '—' : pendingRequests.length}
							</div>
							<Button asChild variant="link" className="h-auto p-0 text-sm">
								<Link href="/notifications?tab=requests">Review requests</Link>
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardDescription>Active borrows</CardDescription>
							<HandshakeIcon className="h-5 w-5 text-primary" />
						</CardHeader>
						<CardContent>
							<div className={`text-3xl font-bold ${isBorrowerLoading || isOwnerLoading ? 'text-muted-foreground' : ''}`}>
								{isBorrowerLoading || isOwnerLoading ? '—' : activeBorrower.length + activeOwner.length}
							</div>
							<Button asChild variant="link" className="h-auto p-0 text-sm">
								<Link href="/activity?tab=active">View activity</Link>
							</Button>
						</CardContent>
					</Card>
				</div>

				<div className="grid gap-6 lg:grid-cols-3">
					<Card className="lg:col-span-2 border-border/60">
						<CardHeader>
							<CardTitle>Recent activity</CardTitle>
							<CardDescription>Latest borrowing and lending updates</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{isBorrowerLoading || isOwnerLoading ? (
								<p className="text-sm text-muted-foreground">Loading activity...</p>
							) : recentTransactions.length === 0 ? (
								<p className="text-sm text-muted-foreground">
									No recent activity yet. Borrow or share an item to get started.
								</p>
							) : (
								recentTransactions.map((transaction, index) => {
									const action =
										transaction.status === 'COMPLETED'
											? 'Returned'
											: transaction.role === 'borrower'
												? 'Borrowed'
												: 'Lent';
									const timeLabel = formatDistanceToNow(
										new Date(transaction.returnedAt || transaction.borrowedAt || transaction.createdAt),
										{ addSuffix: true },
									);
									const counterpart =
										transaction.role === 'borrower'
											? transaction.owner?.name || 'Unknown'
											: transaction.borrower?.name || 'Unknown';

									return (
										<div key={transaction.id} className="space-y-1">
											<div className="flex items-center justify-between text-sm">
												<p className="font-medium text-foreground">
													<span className="text-primary">{action}</span>{' '}
													<Link href={`/items/${transaction.item.id}`} className="hover:underline">
														{transaction.item.name}
													</Link>
												</p>
												<span className="text-xs text-muted-foreground">{timeLabel}</span>
											</div>
											<p className="text-xs text-muted-foreground">
												{transaction.role === 'borrower' ? 'From' : 'To'} {counterpart}
											</p>
											{index < recentTransactions.length - 1 && <Separator className="my-3" />}
										</div>
									);
								})
							)}
						</CardContent>
					</Card>

					<Card className="border-border/60">
						<CardHeader>
							<CardTitle>Pending requests</CardTitle>
							<CardDescription>Incoming borrow requests to review</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{isIncomingLoading ? (
								<p className="text-sm text-muted-foreground">Loading requests...</p>
							) : pendingRequests.length === 0 ? (
								<p className="text-sm text-muted-foreground">No pending requests right now.</p>
							) : (
								pendingRequests.slice(0, 3).map(request => (
									<div key={request.id} className="space-y-1">
										<p className="text-sm font-medium text-foreground">{request.item.name}</p>
										<p className="text-xs text-muted-foreground">
											From {request.requester?.name || 'Unknown'} ·{' '}
											{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
										</p>
									</div>
								))
							)}
							<Button asChild variant="outline" className="w-full">
								<Link href="/notifications?tab=requests">Go to requests</Link>
							</Button>
						</CardContent>
					</Card>
				</div>

				<div className="grid gap-6 lg:grid-cols-2">
					<Card className="border-border/60">
						<CardHeader>
							<CardTitle>Latest alerts</CardTitle>
							<CardDescription>Quick view of recent notifications</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{isNotificationsLoading ? (
								<p className="text-sm text-muted-foreground">Loading alerts...</p>
							) : latestAlerts.length === 0 ? (
								<p className="text-sm text-muted-foreground">No new alerts at the moment.</p>
							) : (
								latestAlerts.map(alert => (
									<div key={alert.id} className="space-y-1">
										<p className="text-sm font-medium text-foreground">{alert.title}</p>
										<p className="text-xs text-muted-foreground">
											{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
										</p>
									</div>
								))
							)}
							<Button asChild variant="outline" className="w-full">
								<Link href="/notifications">View all alerts</Link>
							</Button>
						</CardContent>
					</Card>

					<Card className="border-border/60">
						<CardHeader>
							<CardTitle>Open item requests</CardTitle>
							<CardDescription>Requests from circles that need items</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{isItemRequestsLoading ? (
								<p className="text-sm text-muted-foreground">Loading item requests...</p>
							) : openItemRequests.length === 0 ? (
								<p className="text-sm text-muted-foreground">No open item requests right now.</p>
							) : (
								openItemRequests.slice(0, 3).map(request => (
									<div key={request.id} className="space-y-1">
										<p className="text-sm font-medium text-foreground">{request.title}</p>
										<p className="text-xs text-muted-foreground">
											{request.circle?.name || 'Your circle'} ·{' '}
											{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
										</p>
									</div>
								))
							)}
							<Button asChild variant="outline" className="w-full">
								<Link href="/requests">See all requests</Link>
							</Button>
						</CardContent>
					</Card>
				</div>

				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					<Card className="bg-primary text-primary-foreground">
						<CardHeader>
							<CardTitle>My listings</CardTitle>
							<CardDescription className="text-primary-foreground/80">
								{isItemsLoading ? 'Loading your items...' : `${myItems.length} items shared`}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button size="lg" variant="secondary" className="w-full" asChild>
								<Link href="/listings">
									<Plus className="mr-2 h-4 w-4" />
									Add listing
								</Link>
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Browse items</CardTitle>
							<CardDescription>Find something new to borrow today</CardDescription>
						</CardHeader>
						<CardContent>
							<Button variant="outline" className="w-full gap-2" asChild>
								<Link href="/browse">
									<Search className="h-4 w-4" />
									Explore items
								</Link>
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>My circles</CardTitle>
							<CardDescription>
								{isCirclesLoading ? 'Loading circles...' : `${circles.length} circles`}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button variant="outline" className="w-full gap-2" asChild>
								<Link href="/circles">
									<Users className="h-4 w-4" />
									Manage circles
								</Link>
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Item requests</CardTitle>
							<CardDescription>
								{isItemRequestsLoading ? 'Loading requests...' : `${openItemRequests.length} open requests`}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Button variant="outline" className="w-full gap-2" asChild>
								<Link href="/requests">
									<TrendingUp className="h-4 w-4" />
									View requests
								</Link>
							</Button>
						</CardContent>
					</Card>
				</div>
			</PageShell>
		</div>
	);
}
