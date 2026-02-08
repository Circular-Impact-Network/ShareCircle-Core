'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
	Bell,
	Inbox,
	Check,
	CheckCheck,
	Trash2,
	Loader2,
	Package,
	HandshakeIcon,
	RotateCcw,
	MessageSquare,
	Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, PageShell } from '@/components/ui/page';
import {
	useGetNotificationsQuery,
	useMarkAsReadMutation,
	useMarkAllAsReadMutation,
	useClearNotificationsMutation,
	Notification,
} from '@/lib/redux/api/notificationsApi';
import {
	useGetBorrowRequestsQuery,
	useUpdateBorrowRequestMutation,
	useConfirmReturnMutation,
	BorrowRequest,
} from '@/lib/redux/api/borrowApi';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

type TabType = 'alerts' | 'requests';

// Helper to get icon for notification type
function getNotificationIcon(type: string) {
	switch (type) {
		case 'ITEM_REQUEST_CREATED':
		case 'ITEM_REQUEST_FULFILLED':
			return Package;
		case 'BORROW_REQUEST_RECEIVED':
		case 'BORROW_REQUEST_APPROVED':
		case 'BORROW_REQUEST_DECLINED':
			return HandshakeIcon;
		case 'QUEUE_POSITION_UPDATED':
		case 'QUEUE_ITEM_READY':
			return Clock;
		case 'RETURN_REQUESTED':
		case 'RETURN_CONFIRMED':
			return RotateCcw;
		case 'NEW_MESSAGE':
			return MessageSquare;
		default:
			return Bell;
	}
}

// Alert notification card (passive)
function AlertCard({
	notification,
	onMarkRead,
}: {
	notification: Notification;
	onMarkRead: (id: string) => void;
}) {
	const isUnread = notification.status === 'UNREAD';

	const handleClick = () => {
		if (isUnread) {
			onMarkRead(notification.id);
		}
	};

	// Render icon directly without storing component in a variable
	const renderIcon = () => {
		const Icon = getNotificationIcon(notification.type);
		return Icon ? <Icon className={cn('h-5 w-5', isUnread ? 'text-primary' : 'text-muted-foreground')} /> : null;
	};

	return (
		<Card
			className={cn(
				'cursor-pointer transition-all hover:bg-accent/50',
				isUnread && 'border-primary/30 bg-primary/5'
			)}
			onClick={handleClick}
		>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					<div
						className={cn(
							'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
							isUnread ? 'bg-primary/10' : 'bg-muted'
						)}
					>
						{renderIcon()}
					</div>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2">
							<p className={cn('text-sm font-medium', isUnread && 'text-foreground')}>
								{notification.title}
							</p>
							{isUnread && <div className="h-2 w-2 rounded-full bg-primary" />}
						</div>
						<p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
						<p className="text-xs text-muted-foreground mt-1">
							{formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

// Request card (actionable)
function RequestCard({
	request,
	onApprove,
	onDecline,
	onConfirmReturn,
	isLoading,
}: {
	request: BorrowRequest;
	onApprove: (id: string) => void;
	onDecline: (id: string) => void;
	onConfirmReturn: (id: string) => void;
	isLoading: boolean;
}) {
	const router = useRouter();
	const isPending = request.status === 'PENDING';
	const isReturnPending = request.transaction?.status === 'RETURN_PENDING';

	return (
		<Card>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					{/* Item image */}
					{request.item.imageUrl && (
						<div
							className="h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-muted cursor-pointer"
							onClick={() => router.push(`/items/${request.item.id}`)}
						>
							<img
								src={request.item.imageUrl}
								alt={request.item.name}
								className="h-full w-full object-cover"
							/>
						</div>
					)}
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<p className="text-sm font-medium truncate">{request.item.name}</p>
							<Badge variant={isPending ? 'default' : isReturnPending ? 'secondary' : 'outline'}>
								{isReturnPending ? 'Return Pending' : request.status}
							</Badge>
						</div>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Avatar className="h-5 w-5">
								<AvatarImage src={request.requester.image || undefined} />
								<AvatarFallback className="text-[10px]">
									{request.requester.name?.[0]?.toUpperCase() || '?'}
								</AvatarFallback>
							</Avatar>
							<span className="truncate">{request.requester.name || 'Unknown'}</span>
						</div>
						{request.message && (
							<p className="text-xs text-muted-foreground mt-1 line-clamp-2">&ldquo;{request.message}&rdquo;</p>
						)}
						<p className="text-xs text-muted-foreground mt-1">
							{new Date(request.desiredFrom).toLocaleDateString()} -{' '}
							{new Date(request.desiredTo).toLocaleDateString()}
						</p>

						{/* Actions */}
						{isPending && (
							<div className="flex gap-2 mt-3">
								<Button
									size="sm"
									onClick={() => onApprove(request.id)}
									disabled={isLoading}
									className="flex-1"
								>
									{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
									Approve
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() => onDecline(request.id)}
									disabled={isLoading}
									className="flex-1"
								>
									Decline
								</Button>
							</div>
						)}
						{isReturnPending && (
							<div className="mt-3">
								<Button
									size="sm"
									onClick={() => onConfirmReturn(request.id)}
									disabled={isLoading}
									className="w-full"
								>
									{isLoading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<CheckCheck className="h-4 w-4 mr-1" />
									)}
									Confirm Return
								</Button>
							</div>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export function NotificationsPage() {
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState<TabType>('alerts');
	const [processingId, setProcessingId] = useState<string | null>(null);

	// Fetch all notifications (the global provider handles realtime updates)
	const {
		data: alertsData,
		isLoading: alertsLoading,
	} = useGetNotificationsQuery({ limit: 50 });

	// Fetch actionable borrow requests (incoming pending + return pending)
	const { data: incomingRequests = [], isLoading: requestsLoading, refetch: refetchRequests } = useGetBorrowRequestsQuery({
		type: 'incoming',
	});

	// Filter to show only actionable requests
	const actionableRequests = incomingRequests.filter(
		r => r.status === 'PENDING' || r.transaction?.status === 'RETURN_PENDING'
	);

	// Mutations
	const [markAsRead] = useMarkAsReadMutation();
	const [markAllAsRead] = useMarkAllAsReadMutation();
	const [clearNotifications] = useClearNotificationsMutation();
	const [updateBorrowRequest] = useUpdateBorrowRequestMutation();
	const [confirmReturn] = useConfirmReturnMutation();

	// Handlers
	const handleMarkRead = async (id: string) => {
		try {
			await markAsRead(id).unwrap();
		} catch (error) {
			console.error('Failed to mark as read:', error);
		}
	};

	const handleMarkAllRead = async () => {
		try {
			await markAllAsRead().unwrap();
			toast({ title: 'All notifications marked as read' });
		} catch {
			toast({ title: 'Failed to mark all as read', variant: 'destructive' });
		}
	};

	const handleClearAll = async () => {
		try {
			await clearNotifications().unwrap();
			toast({ title: 'Notifications cleared' });
		} catch {
			toast({ title: 'Failed to clear notifications', variant: 'destructive' });
		}
	};

	const handleApprove = async (id: string) => {
		setProcessingId(id);
		try {
			await updateBorrowRequest({ id, action: 'approve' }).unwrap();
			toast({ title: 'Request approved!' });
			// Manually refetch to ensure UI updates immediately
			await refetchRequests();
			// Ensure processingId is reset
			setProcessingId(null);
		} catch (err) {
			console.error('Approve request error:', err);
			const errorMessage = err && typeof err === 'object' && 'data' in err
				? (err as { data?: { error?: string } }).data?.error || 'Failed to approve request'
				: 'Failed to approve request';
			toast({ 
				title: 'Failed to approve request', 
				description: errorMessage,
				variant: 'destructive' 
			});
			setProcessingId(null);
		}
	};

	const handleDecline = async (id: string) => {
		setProcessingId(id);
		try {
			await updateBorrowRequest({ id, action: 'decline' }).unwrap();
			toast({ title: 'Request declined' });
			// Manually refetch to ensure UI updates immediately
			await refetchRequests();
			setProcessingId(null);
		} catch (err) {
			console.error('Decline request error:', err);
			const errorMessage = err && typeof err === 'object' && 'data' in err
				? (err.data as { error?: string })?.error || 'Failed to decline request'
				: 'Failed to decline request';
			toast({ 
				title: 'Failed to decline request',
				description: errorMessage,
				variant: 'destructive' 
			});
			setProcessingId(null);
		}
	};

	const handleConfirmReturn = async (id: string) => {
		setProcessingId(id);
		try {
			await confirmReturn(id).unwrap();
			toast({ title: 'Return confirmed!' });
		} catch {
			toast({ title: 'Failed to confirm return', variant: 'destructive' });
		} finally {
			setProcessingId(null);
		}
	};

	const alerts = alertsData?.notifications || [];
	const unreadCount = alertsData?.unreadCount || 0;

	return (
		<PageShell className="space-y-6">
			<PageHeader
				title="Notifications"
				description="Stay updated with your circles and borrow requests"
			/>

			<Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabType)} className="w-full">
				<div className="flex items-center justify-between mb-4">
					<TabsList>
						<TabsTrigger value="alerts" className="gap-2">
							<Bell className="h-4 w-4" />
							Alerts
							{unreadCount > 0 && (
								<Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
									{unreadCount}
								</Badge>
							)}
						</TabsTrigger>
						<TabsTrigger value="requests" className="gap-2">
							<Inbox className="h-4 w-4" />
							Requests
							{actionableRequests.length > 0 && (
								<Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-xs">
									{actionableRequests.length}
								</Badge>
							)}
						</TabsTrigger>
					</TabsList>

					<div className="flex gap-2">
						{activeTab === 'alerts' && alerts.length > 0 && (
							<>
								<Button variant="outline" size="sm" onClick={handleMarkAllRead}>
									<CheckCheck className="h-4 w-4 mr-1" />
									Mark all read
								</Button>
								<Button variant="ghost" size="sm" onClick={handleClearAll}>
									<Trash2 className="h-4 w-4" />
								</Button>
							</>
						)}
					</div>
				</div>

				{/* Alerts Tab */}
				<TabsContent value="alerts" className="space-y-3">
					{alertsLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
					) : alerts.length === 0 ? (
						<Card className="border-dashed">
							<CardContent className="flex flex-col items-center gap-4 text-center py-12">
								<div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
									<Bell className="h-7 w-7 text-muted-foreground" />
								</div>
								<div>
									<p className="font-medium">No alerts yet</p>
									<p className="text-sm text-muted-foreground">
										You&apos;ll see updates about your circles and requests here
									</p>
								</div>
							</CardContent>
						</Card>
					) : (
						alerts.map(notification => (
							<AlertCard
								key={notification.id}
								notification={notification}
								onMarkRead={handleMarkRead}
							/>
						))
					)}
				</TabsContent>

				{/* Requests Tab */}
				<TabsContent value="requests" className="space-y-3">
					{requestsLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
					) : actionableRequests.length === 0 ? (
						<Card className="border-dashed">
							<CardContent className="flex flex-col items-center gap-4 text-center py-12">
								<div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
									<Inbox className="h-7 w-7 text-muted-foreground" />
								</div>
								<div>
									<p className="font-medium">No pending requests</p>
									<p className="text-sm text-muted-foreground">
										Borrow requests from your circles will appear here
									</p>
								</div>
							</CardContent>
						</Card>
					) : (
						actionableRequests.map(request => (
							<RequestCard
								key={request.id}
								request={request}
								onApprove={handleApprove}
								onDecline={handleDecline}
								onConfirmReturn={handleConfirmReturn}
								isLoading={processingId === request.id}
							/>
						))
					)}
				</TabsContent>
			</Tabs>
		</PageShell>
	);
}
