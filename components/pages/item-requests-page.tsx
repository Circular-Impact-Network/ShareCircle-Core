'use client';

// Item requests: multi-circle create, list, fulfill
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
	Package,
	Plus,
	Clock,
	Loader2,
	Search,
	Send,
	Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { PageHeader, PageShell } from '@/components/ui/page';
import { PageTabs, PageTabsContent, PageTabsList, PageTabsTrigger } from '@/components/ui/app-tabs';
import { InfiniteScrollSentinel } from '@/components/ui/infinite-scroll-sentinel';
import {
	useGetItemRequestsQuery,
	useCreateItemRequestMutation,
	useUpdateItemRequestMutation,
	ItemRequest,
} from '@/lib/redux/api/borrowApi';
import { useGetAllItemsQuery } from '@/lib/redux/api/itemsApi';
import { useGetCirclesQuery } from '@/lib/redux/api/circlesApi';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { useProgressivePagination } from '@/hooks/use-progressive-pagination';

type TabType = 'all' | 'mine';

function RequestCard({
	request,
	onFulfill,
	onClose,
	isMyRequest,
	isFulfilling,
	isClosing,
}: {
	request: ItemRequest;
	onFulfill?: (requestId: string, requesterId: string, requestTitle: string) => void;
	onClose?: (requestId: string) => void;
	isMyRequest: boolean;
	isFulfilling?: boolean;
	isClosing?: boolean;
}) {
	const isOpen = request.status === 'OPEN';
	const isFulfilled = request.status === 'FULFILLED';

	const hasDates = !!(request.desiredFrom && request.desiredTo);

	const circleNames = request.circles?.map(entry => entry.circle.name) ?? [];

	return (
		<Card className={isOpen ? '' : 'opacity-60'} data-testid="request-card" data-status={request.status} data-has-dates={hasDates ? 'true' : 'false'}>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					<div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
						<Package className="h-5 w-5 text-primary" />
					</div>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<p className="text-sm font-medium">{request.title}</p>
							<Badge variant={isOpen ? 'default' : isFulfilled ? 'secondary' : 'outline'}>
								{request.status}
							</Badge>
						</div>
						{request.description && (
							<p className="text-sm text-muted-foreground line-clamp-2 mb-2">
								{request.description}
							</p>
						)}
						<div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid="requester">
							<Avatar className="h-4 w-4">
								<AvatarImage src={request.requester.image || undefined} />
								<AvatarFallback className="text-[8px]">
									{request.requester.name?.[0]?.toUpperCase() || '?'}
								</AvatarFallback>
							</Avatar>
							<span>{request.requester.name || 'Unknown'}</span>
							<span>•</span>
							<span>{circleNames.join(', ') || request.circle?.name || 'Circle'}</span>
							<span>•</span>
							<span>{formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}</span>
						</div>
						{hasDates && (
							<p className="text-xs text-muted-foreground mt-1" data-testid="date-range">
								Needed: {new Date(request.desiredFrom!).toLocaleDateString()} -{' '}
								{new Date(request.desiredTo!).toLocaleDateString()}
							</p>
						)}

						{/* Actions */}
						{isOpen && !isMyRequest && onFulfill && (
							<div className="mt-3 flex flex-wrap gap-2">
								<Button
									size="sm"
									variant="outline"
									className="gap-2"
									disabled={isFulfilling}
									onClick={() => onFulfill(request.id, request.requester.id, request.title)}
								>
									{isFulfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
									I have this item
								</Button>
							</div>
						)}
						{isOpen && isMyRequest && onClose && (
							<div className="mt-3 flex flex-wrap gap-2">
								<Button
									size="sm"
									variant="outline"
									className="gap-2"
									disabled={isClosing}
									onClick={() => onClose(request.id)}
								>
									{isClosing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
									Close request
								</Button>
							</div>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export function ItemRequestsPage() {
	const router = useRouter();
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState<TabType>('all');
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [requestTitle, setRequestTitle] = useState('');
	const [requestDescription, setRequestDescription] = useState('');
	const [requestCircleIds, setRequestCircleIds] = useState<string[]>([]);
	const [startingChatForRequestId, setStartingChatForRequestId] = useState<string | null>(null);
	const [closingRequestId, setClosingRequestId] = useState<string | null>(null);

	// Fetch data
	const { data: allRequests = [], isLoading: allLoading } = useGetItemRequestsQuery({});
	const { data: myRequests = [], isLoading: myLoading } = useGetItemRequestsQuery({ myRequests: true });
	// Keep items query for potential future use
	useGetAllItemsQuery();

	// Get user's circles (only circles the user is a member of)
	const { data: circles = [] } = useGetCirclesQuery();

	// Mutations
	const [createItemRequest, { isLoading: isCreating }] = useCreateItemRequestMutation();
	const [updateItemRequest] = useUpdateItemRequestMutation();

	// Filter open requests
	const openRequests = allRequests.filter(r => r.status === 'OPEN');
	const myOpenRequests = myRequests.filter(r => r.status === 'OPEN');
	const {
		visibleItems: visibleOpenRequests,
		hasMore: hasMoreOpenRequests,
		loadMore: loadMoreOpenRequests,
	} = useProgressivePagination({ items: openRequests, pageSize: 8 });
	const {
		visibleItems: visibleMyRequests,
		hasMore: hasMoreMyRequests,
		loadMore: loadMoreMyRequests,
	} = useProgressivePagination({ items: myRequests, pageSize: 8 });
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
			const errorMessage = error && typeof error === 'object' && 'data' in error
				? (error.data as { error?: string })?.error || 'Failed to create request'
				: 'Failed to create request. Please try again.';
			toast({ 
				title: 'Failed to create request', 
				description: errorMessage,
				variant: 'destructive' 
			});
		}
	};

	const handleFulfill = async (requestId: string, requesterId: string, requestTitleText: string) => {
		setStartingChatForRequestId(requestId);
		try {
			const threadResponse = await fetch('/api/messages/threads', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ otherUserId: requesterId }),
			});
			if (!threadResponse.ok) {
				const errorData = await threadResponse.json().catch(() => ({}));
				throw new Error(errorData.error || 'Failed to start conversation');
			}

			const thread = await threadResponse.json();
			const draft = `I have this item and can help with your request: "${requestTitleText}".`;
			router.push(`/messages/${thread.id}?draft=${encodeURIComponent(draft)}`);
		} catch (error) {
			console.error('Start fulfillment chat error:', error);
			toast({
				title: 'Unable to message requester',
				description: error instanceof Error ? error.message : 'Please try again.',
				variant: 'destructive',
			});
		} finally {
			setStartingChatForRequestId(null);
		}
	};

	const handleCloseRequest = async (requestId: string) => {
		setClosingRequestId(requestId);
		try {
			await updateItemRequest({ id: requestId, status: 'CANCELLED' }).unwrap();
			toast({
				title: 'Request closed',
				description: 'Your request has been closed and will no longer accept responses.',
			});
		} catch (error) {
			console.error('Close request error:', error);
			const errorMessage =
				error && typeof error === 'object' && 'data' in error
					? (error.data as { error?: string })?.error || 'Failed to close request'
					: 'Failed to close request.';
			toast({
				title: 'Unable to close request',
				description: errorMessage,
				variant: 'destructive',
			});
		} finally {
			setClosingRequestId(null);
		}
	};

	const isLoading = allLoading || myLoading;

	return (
		<PageShell className="space-y-6">
			<div className="flex items-center justify-between">
				<PageHeader
					title="Item Requests"
					description="See what items people in your circles are looking for"
				/>
				<Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
					<DialogTrigger asChild>
						<Button className="gap-2">
							<Plus className="h-4 w-4" />
							New Request
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
							<div className="space-y-2">
								<Input
									placeholder="What are you looking for?"
									value={requestTitle}
									onChange={e => setRequestTitle(e.target.value)}
								/>
							</div>
							<div className="space-y-2">
								<Textarea
									placeholder="Add details (optional)"
									value={requestDescription}
									onChange={e => setRequestDescription(e.target.value)}
									rows={3}
								/>
							</div>
							<div className="space-y-2">
								<p className="text-sm text-muted-foreground">Share this request with circles *</p>
								{circles.length > 1 && (
									<Button variant="outline" type="button" onClick={toggleSelectAllCircles}>
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
														isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground'
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
								disabled={isCreating || !requestTitle.trim() || requestCircleIds.length === 0}
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

			<PageTabs value={activeTab} onValueChange={v => setActiveTab(v as TabType)}>
				<PageTabsList>
					<PageTabsTrigger value="all" className="gap-2" badge={openRequests.length > 0 ? openRequests.length : undefined}>
						<Search className="h-4 w-4" />
						All Requests
					</PageTabsTrigger>
					<PageTabsTrigger value="mine" className="gap-2" badge={myOpenRequests.length > 0 ? myOpenRequests.length : undefined}>
						<Clock className="h-4 w-4" />
						My Requests
					</PageTabsTrigger>
				</PageTabsList>

				{/* All Requests Tab */}
				<PageTabsContent value="all" className="space-y-3">
					{isLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
					) : openRequests.length === 0 ? (
						<Card className="border-dashed">
							<CardContent className="flex flex-col items-center gap-4 text-center py-12">
								<div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
									<Package className="h-7 w-7 text-muted-foreground" />
								</div>
								<div>
									<p className="font-medium">No open requests</p>
									<p className="text-sm text-muted-foreground">
										Item requests from your circles will appear here
									</p>
								</div>
							</CardContent>
						</Card>
					) : (
						<div className="space-y-3" data-testid="requests-list">
							{visibleOpenRequests.map(request => (
								<RequestCard
									key={request.id}
									request={request}
									onFulfill={handleFulfill}
									isFulfilling={startingChatForRequestId === request.id}
									isMyRequest={myRequests.some(r => r.id === request.id)}
								/>
							))}
							<InfiniteScrollSentinel
								hasMore={hasMoreOpenRequests}
								onLoadMore={loadMoreOpenRequests}
								enabled={activeTab === 'all'}
								label="Loading more requests"
							/>
						</div>
					)}
				</PageTabsContent>

				{/* My Requests Tab */}
				<PageTabsContent value="mine" className="space-y-3">
					{myLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
					) : myRequests.length === 0 ? (
						<Card className="border-dashed">
							<CardContent className="flex flex-col items-center gap-4 text-center py-12">
								<div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
									<Clock className="h-7 w-7 text-muted-foreground" />
								</div>
								<div>
									<p className="font-medium">No requests yet</p>
									<p className="text-sm text-muted-foreground">
										Create a request to let circles know what you need
									</p>
								</div>
								<Button onClick={() => setShowCreateModal(true)} className="gap-2">
									<Plus className="h-4 w-4" />
									Create Request
								</Button>
							</CardContent>
						</Card>
					) : (
						<div className="space-y-3" data-testid="my-requests-list">
							{visibleMyRequests.map(request => (
								<RequestCard
									key={request.id}
									request={request}
									isMyRequest={true}
									onClose={handleCloseRequest}
									isClosing={closingRequestId === request.id}
								/>
							))}
							<InfiniteScrollSentinel
								hasMore={hasMoreMyRequests}
								onLoadMore={loadMoreMyRequests}
								enabled={activeTab === 'mine'}
								label="Loading more requests"
							/>
						</div>
					)}
				</PageTabsContent>
			</PageTabs>
		</PageShell>
	);
}
