'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
	Bell,
	Inbox,
	Check,
	CheckCheck,
	Trash2,
	Loader2,
	Package,
	HandshakeIcon,
	Plus,
	Send,
	PackageOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { PageHeader, PageShell, PageStickyHeader } from '@/components/ui/page';
import { PageTabs, PageTabsContent, PageTabsList, PageTabsTrigger } from '@/components/ui/app-tabs';
import { InfiniteScrollSentinel } from '@/components/ui/infinite-scroll-sentinel';
import { NotificationListSkeleton, RequestCardListSkeleton } from '@/components/ui/skeletons';
import {
	useGetNotificationsQuery,
	useMarkAsReadMutation,
	useMarkAllAsReadMutation,
	useClearNotificationsMutation,
	Notification,
} from '@/lib/redux/api/notificationsApi';
import {
	useGetBorrowRequestsQuery,
	useGetItemRequestsQuery,
	useCreateItemRequestMutation,
} from '@/lib/redux/api/borrowApi';
import { useGetCirclesQuery } from '@/lib/redux/api/circlesApi';
import { useToast } from '@/hooks/useToast';
import { useProgressivePagination } from '@/hooks/useProgressivePagination';
import { useBorrowNotificationActions } from '@/hooks/useBorrowNotificationActions';
import { useItemRequestNotificationActions } from '@/hooks/useItemRequestNotificationActions';
import { ItemRequestCard } from '@/components/cards/item-request-card';
import { AlertCard } from '@/components/cards/alert-card';
import { BorrowRequestCard } from '@/components/cards/borrow-request-card';
import { ItemRequestFilter, type ItemRequestFilterValue } from '@/components/app/item-request-filter';

type TabType = 'alerts' | 'borrow-requests' | 'item-requests';

export function NotificationsPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { toast } = useToast();

	// Read tab from URL
	const tabFromUrl = searchParams.get('tab') as TabType | null;
	const [activeTab, setActiveTab] = useState<TabType>(tabFromUrl || 'alerts');
	const [alertsLimit, setAlertsLimit] = useState(20);
	const [itemFilter, setItemFilter] = useState<ItemRequestFilterValue>('from-others');

	// Item request create modal state
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [requestTitle, setRequestTitle] = useState('');
	const [requestDescription, setRequestDescription] = useState('');
	const [requestCircleIds, setRequestCircleIds] = useState<string[]>([]);

	// Sync tab when URL changes (deep-links from notifications) — legitimate
	// effect, the rule below over-fires for URL-driven state.
	useEffect(() => {
		if (tabFromUrl && ['alerts', 'borrow-requests', 'item-requests'].includes(tabFromUrl)) {
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setActiveTab(tabFromUrl);
		}
	}, [tabFromUrl]);

	// Fetch notifications
	const {
		data: alertsData,
		isLoading: alertsLoading,
		isFetching: alertsFetching,
	} = useGetNotificationsQuery({ limit: alertsLimit });

	// Fetch borrow requests
	const {
		data: incomingRequests = [],
		isLoading: requestsLoading,
		refetch: refetchRequests,
	} = useGetBorrowRequestsQuery({ type: 'incoming' });

	// Fetch item requests
	const { data: allItemRequests = [], isLoading: itemRequestsLoading } = useGetItemRequestsQuery({});
	const { data: myItemRequests = [] } = useGetItemRequestsQuery({ myRequests: true });

	// Circles for create modal
	const { data: circles = [] } = useGetCirclesQuery();

	// Filter actionable borrow requests
	const actionableRequests = useMemo(
		() =>
			incomingRequests.filter(
				r =>
					r.status === 'PENDING' ||
					r.transaction?.status === 'RETURN_PENDING' ||
					(r.status === 'APPROVED' &&
						(r.transaction?.status === 'ACTIVE' ||
							r.transaction?.status === 'LENDER_CONFIRMED' ||
							r.transaction?.status === 'BORROWER_CONFIRMED')),
			),
		[incomingRequests],
	);

	const myRequestIds = useMemo(() => new Set(myItemRequests.map(r => r.id)), [myItemRequests]);

	// Filter item requests based on selected filter
	const filteredItemRequests = useMemo(() => {
		if (itemFilter === 'mine') return myItemRequests;
		if (itemFilter === 'all') return allItemRequests;
		// 'from-others': open, not ignored, not mine
		return allItemRequests.filter(r => !myRequestIds.has(r.id));
	}, [allItemRequests, myItemRequests, myRequestIds, itemFilter]);

	// Badge count = open requests from others (default view)
	const openItemRequestCount = useMemo(
		() => allItemRequests.filter(r => !myRequestIds.has(r.id)).length,
		[allItemRequests, myRequestIds],
	);

	const {
		visibleItems: visibleActionableRequests,
		hasMore: hasMoreActionableRequests,
		loadMore: loadMoreActionableRequests,
	} = useProgressivePagination({ items: actionableRequests, pageSize: 8 });

	const {
		visibleItems: visibleItemRequests,
		hasMore: hasMoreItemRequests,
		loadMore: loadMoreItemRequests,
	} = useProgressivePagination({ items: filteredItemRequests, pageSize: 8 });

	// Mutations
	const [markAsRead] = useMarkAsReadMutation();
	const [markAllAsRead] = useMarkAllAsReadMutation();
	const [clearNotifications] = useClearNotificationsMutation();
	const [createItemRequest, { isLoading: isCreating }] = useCreateItemRequestMutation();

	// Action handlers extracted into hooks so this page stays composition-only.
	const {
		processingId,
		completedActions,
		handleApprove,
		handleDecline,
		handleConfirmReturn,
		handleConfirmHandoff,
		handleConfirmReceipt,
	} = useBorrowNotificationActions({ refetchRequests });

	const { respondingRequestId, handleRespond, handleOpenChat, handleIgnore, handleCloseRequest } =
		useItemRequestNotificationActions({ router });

	// Alert handlers
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

	// Alert click navigation
	const handleAlertNavigate = (notification: Notification) => {
		const metadata = notification.metadata as Record<string, unknown> | undefined;

		switch (notification.type) {
			case 'BORROW_REQUEST_RECEIVED':
				setActiveTab('borrow-requests');
				return;
			case 'BORROW_REQUEST_APPROVED':
				router.push('/activity');
				return;
			case 'ITEM_HANDOFF_CONFIRMED':
			case 'ITEM_RECEIVED_CONFIRMED':
			case 'RETURN_REQUESTED':
			case 'RETURN_CONFIRMED':
				router.push('/activity');
				return;
			case 'NEW_MESSAGE':
				if (metadata?.conversationId) {
					router.push(`/messages/${metadata.conversationId}`);
				}
				return;
			case 'ITEM_REQUEST_CREATED':
			case 'ITEM_REQUEST_FULFILLED':
				setActiveTab('item-requests');
				return;
			default:
				if (metadata?.path && typeof metadata.path === 'string') {
					router.push(metadata.path);
				}
		}
	};

	// Create item request
	const allCirclesSelected = circles.length > 0 && requestCircleIds.length === circles.length;

	const toggleCircleSelection = (circleId: string) => {
		setRequestCircleIds(prev =>
			prev.includes(circleId) ? prev.filter(id => id !== circleId) : [...prev, circleId],
		);
	};

	const toggleSelectAllCircles = () => {
		if (allCirclesSelected) {
			setRequestCircleIds([]);
			return;
		}
		setRequestCircleIds(circles.map(circle => circle.id));
	};

	const handleCreate = async () => {
		if (!requestTitle.trim() || requestCircleIds.length === 0) {
			toast({ title: 'Please fill in required fields', variant: 'destructive' });
			return;
		}
		try {
			await createItemRequest({
				title: requestTitle.trim(),
				description: requestDescription.trim() || undefined,
				circleIds: requestCircleIds,
			}).unwrap();
			toast({ title: 'Request created!', description: 'Circle members will be notified.' });
			setShowCreateModal(false);
			setRequestTitle('');
			setRequestDescription('');
			setRequestCircleIds([]);
		} catch (error) {
			console.error('Create item request error:', error);
			const errorMessage =
				error && typeof error === 'object' && 'data' in error
					? (error.data as { error?: string })?.error || 'Failed to create request'
					: 'Failed to create request. Please try again.';
			toast({ title: 'Failed to create request', description: errorMessage, variant: 'destructive' });
		}
	};

	const alerts = alertsData?.notifications || [];
	const unreadCount = alertsData?.unreadCount || 0;
	const hasMoreAlerts = alertsData?.pagination.hasMore ?? false;

	return (
		<PageShell>
			<PageTabs value={activeTab} onValueChange={v => setActiveTab(v as TabType)}>
				<PageStickyHeader className="pt-2 sm:pt-6 lg:pt-7 pb-3 space-y-3">
					<PageHeader
						title="Notifications"
						description="Stay updated with your circles, borrow requests, and item requests"
					/>

					{/* Tabs row — full width */}
					<PageTabsList className="w-full">
						<PageTabsTrigger
							value="alerts"
							className="gap-1.5"
							badge={unreadCount > 0 ? unreadCount : undefined}
						>
							<Bell className="h-4 w-4 shrink-0" />
							Alerts
						</PageTabsTrigger>
						<PageTabsTrigger
							value="borrow-requests"
							className="gap-1.5"
							badge={actionableRequests.length > 0 ? actionableRequests.length : undefined}
						>
							<HandshakeIcon className="h-4 w-4 shrink-0" />
							<span className="sm:hidden">Borrows</span>
							<span className="hidden sm:inline">Borrow Requests</span>
						</PageTabsTrigger>
						<PageTabsTrigger
							value="item-requests"
							className="gap-1.5"
							badge={openItemRequestCount > 0 ? openItemRequestCount : undefined}
						>
							<Package className="h-4 w-4 shrink-0" />
							<span className="sm:hidden">Items</span>
							<span className="hidden sm:inline">Requested Items</span>
						</PageTabsTrigger>
					</PageTabsList>

					{/* Contextual action row: filters + button OR alert actions */}
					{activeTab === 'item-requests' && (
						<div className="flex items-center justify-between gap-2">
							<ItemRequestFilter value={itemFilter} onChange={setItemFilter} />
							<Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
								<DialogTrigger asChild>
									<Button size="sm" className="shrink-0 gap-1">
										<Plus className="h-4 w-4" />
										<span className="hidden sm:inline">New </span>Request
									</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Request an Item</DialogTitle>
										<DialogDescription>
											Let your circles know what you&apos;re looking for
										</DialogDescription>
									</DialogHeader>
									<div className="space-y-4 py-4">
										<Input
											placeholder="What are you looking for?"
											value={requestTitle}
											onChange={e => setRequestTitle(e.target.value)}
										/>
										<Textarea
											placeholder="Add details (optional)"
											value={requestDescription}
											onChange={e => setRequestDescription(e.target.value)}
											rows={3}
										/>
										<div className="space-y-2">
											<p className="text-sm text-muted-foreground">
												Share this request with circles *
											</p>
											{circles.length > 1 && (
												<Button
													variant="outline"
													type="button"
													onClick={toggleSelectAllCircles}
												>
													{allCirclesSelected ? 'Deselect All Circles' : 'Select All Circles'}
												</Button>
											)}
											<div className="app-scrollbar app-scrollbar-thin flex max-h-44 flex-col gap-2 overflow-auto rounded-md border p-2">
												{circles.map(circle => {
													const isSelected = requestCircleIds.includes(circle.id);
													return (
														<button
															key={circle.id}
															type="button"
															onClick={() => toggleCircleSelection(circle.id)}
															className={`flex items-center gap-2 rounded px-2 py-2 text-left text-sm ${
																isSelected ? 'bg-primary/10' : 'hover:bg-muted'
															}`}
														>
															<div
																className={`h-4 w-4 rounded border flex items-center justify-center ${
																	isSelected
																		? 'border-primary bg-primary text-primary-foreground'
																		: 'border-muted-foreground'
																}`}
															>
																{isSelected && <Check className="h-3 w-3" />}
															</div>
															<span>{circle.name}</span>
														</button>
													);
												})}
											</div>
										</div>
									</div>
									<DialogFooter>
										<Button variant="outline" onClick={() => setShowCreateModal(false)}>
											Cancel
										</Button>
										<Button
											onClick={handleCreate}
											disabled={
												isCreating || !requestTitle.trim() || requestCircleIds.length === 0
											}
										>
											{isCreating ? (
												<Loader2 className="h-4 w-4 animate-spin mr-2" />
											) : (
												<Send className="h-4 w-4 mr-2" />
											)}
											Create Request
										</Button>
									</DialogFooter>
								</DialogContent>
							</Dialog>
						</div>
					)}
					{activeTab === 'alerts' && alerts.length > 0 && (
						<div className="flex justify-end gap-2">
							<Button variant="outline" size="sm" onClick={handleMarkAllRead}>
								<CheckCheck className="h-4 w-4" />
								<span className="ml-1 hidden sm:inline">Mark all read</span>
							</Button>
							<Button variant="ghost" size="icon" className="h-9 w-9" onClick={handleClearAll}>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					)}
				</PageStickyHeader>

				{/* Alerts Tab */}
				<PageTabsContent value="alerts" className="space-y-3">
					{alertsLoading ? (
						<NotificationListSkeleton count={5} />
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
						alerts.map(notification => {
							const meta = notification.metadata as Record<string, unknown> | undefined;
							const borrowRequestId = meta?.borrowRequestId as string | undefined;
							const doneLabel = borrowRequestId ? completedActions.get(borrowRequestId) : undefined;
							let actionLabel: string | undefined;
							let onAction: (() => void) | undefined;
							if (!doneLabel && borrowRequestId) {
								if (notification.type === 'ITEM_HANDOFF_CONFIRMED') {
									actionLabel = 'Confirm I Received It';
									onAction = () => handleConfirmReceipt(borrowRequestId);
								} else if (notification.type === 'RETURN_REQUESTED') {
									actionLabel = 'Confirm Return';
									onAction = () => handleConfirmReturn(borrowRequestId);
								}
							}
							return (
								<AlertCard
									key={notification.id}
									notification={notification}
									onMarkRead={handleMarkRead}
									onNavigate={handleAlertNavigate}
									actionLabel={actionLabel}
									onAction={onAction}
									isActionLoading={!!borrowRequestId && processingId === borrowRequestId}
									actionDoneLabel={doneLabel}
								/>
							);
						})
					)}
					<InfiniteScrollSentinel
						hasMore={hasMoreAlerts}
						isLoading={alertsFetching && alerts.length > 0}
						onLoadMore={() => setAlertsLimit(current => current + 20)}
						enabled={activeTab === 'alerts'}
						label="Loading more alerts"
					/>
				</PageTabsContent>

				{/* Borrow Requests Tab */}
				<PageTabsContent value="borrow-requests" className="space-y-3">
					{requestsLoading ? (
						<RequestCardListSkeleton count={4} />
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
						visibleActionableRequests.map(request => (
							<BorrowRequestCard
								key={request.id}
								request={request}
								onApprove={handleApprove}
								onDecline={handleDecline}
								onConfirmReturn={handleConfirmReturn}
								onConfirmHandoff={handleConfirmHandoff}
								isLoading={processingId === request.id}
							/>
						))
					)}
					<InfiniteScrollSentinel
						hasMore={hasMoreActionableRequests}
						onLoadMore={loadMoreActionableRequests}
						enabled={activeTab === 'borrow-requests'}
						label="Loading more requests"
					/>
				</PageTabsContent>

				{/* Item Requests Tab */}
				<PageTabsContent value="item-requests" className="space-y-3">
					{itemRequestsLoading ? (
						<RequestCardListSkeleton count={4} />
					) : filteredItemRequests.length === 0 ? (
						<Card className="border-dashed">
							<CardContent className="flex flex-col items-center gap-4 text-center py-12">
								<div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
									<PackageOpen className="h-7 w-7 text-muted-foreground" />
								</div>
								<div>
									<p className="font-medium">
										{itemFilter === 'mine' ? 'You have no item requests' : 'No item requests'}
									</p>
									<p className="text-sm text-muted-foreground">
										{itemFilter === 'from-others'
											? 'Requests from your circle members will appear here'
											: itemFilter === 'mine'
												? 'Post a request to let your circles know what you need'
												: 'No item requests from your circles yet'}
									</p>
								</div>
							</CardContent>
						</Card>
					) : (
						visibleItemRequests.map(request => (
							<ItemRequestCard
								key={request.id}
								request={request}
								onRespond={handleRespond}
								onIgnore={handleIgnore}
								onClose={handleCloseRequest}
								onChat={handleOpenChat}
								isMyRequest={myItemRequests.some(r => r.id === request.id)}
								isResponding={respondingRequestId === request.id}
							/>
						))
					)}
					<InfiniteScrollSentinel
						hasMore={hasMoreItemRequests}
						onLoadMore={loadMoreItemRequests}
						enabled={activeTab === 'item-requests'}
						label="Loading more requests"
					/>
				</PageTabsContent>
			</PageTabs>
		</PageShell>
	);
}
