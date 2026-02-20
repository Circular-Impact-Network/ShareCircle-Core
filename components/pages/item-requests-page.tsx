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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
	useGetItemRequestsQuery,
	useCreateItemRequestMutation,
	ItemRequest,
} from '@/lib/redux/api/borrowApi';
import { useGetAllItemsQuery } from '@/lib/redux/api/itemsApi';
import { useGetCirclesQuery } from '@/lib/redux/api/circlesApi';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

type TabType = 'all' | 'mine';

function RequestCard({
	request,
	onFulfill,
	isMyRequest,
	isFulfilling,
}: {
	request: ItemRequest;
	onFulfill?: (requestId: string, requesterId: string, requestTitle: string) => void;
	isMyRequest: boolean;
	isFulfilling?: boolean;
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
							<Button
								size="sm"
								variant="outline"
								className="mt-3 gap-2"
								disabled={isFulfilling}
								onClick={() => onFulfill(request.id, request.requester.id, request.title)}
							>
								{isFulfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
								I have this item
							</Button>
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

	// Fetch data
	const { data: allRequests = [], isLoading: allLoading } = useGetItemRequestsQuery({});
	const { data: myRequests = [], isLoading: myLoading } = useGetItemRequestsQuery({ myRequests: true });
	// Keep items query for potential future use
	useGetAllItemsQuery();

	// Get user's circles (only circles the user is a member of)
	const { data: circles = [] } = useGetCirclesQuery();

	// Mutations
	const [createItemRequest, { isLoading: isCreating }] = useCreateItemRequestMutation();

	// Filter open requests
	const openRequests = allRequests.filter(r => r.status === 'OPEN');
	const myOpenRequests = myRequests.filter(r => r.status === 'OPEN');
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
								<div className="flex flex-col gap-2 max-h-44 overflow-auto rounded-md border p-2">
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

			<Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabType)} className="w-full">
				<TabsList className="mb-4">
					<TabsTrigger value="all" className="gap-2">
						<Search className="h-4 w-4" />
						All Requests
						{openRequests.length > 0 && (
							<Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
								{openRequests.length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="mine" className="gap-2">
						<Clock className="h-4 w-4" />
						My Requests
						{myOpenRequests.length > 0 && (
							<Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
								{myOpenRequests.length}
							</Badge>
						)}
					</TabsTrigger>
				</TabsList>

				{/* All Requests Tab */}
				<TabsContent value="all" className="space-y-3">
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
							{openRequests.map(request => (
								<RequestCard
									key={request.id}
									request={request}
									onFulfill={handleFulfill}
									isFulfilling={startingChatForRequestId === request.id}
									isMyRequest={myRequests.some(r => r.id === request.id)}
								/>
							))}
						</div>
					)}
				</TabsContent>

				{/* My Requests Tab */}
				<TabsContent value="mine" className="space-y-3">
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
							{myRequests.map(request => (
								<RequestCard key={request.id} request={request} isMyRequest={true} />
							))}
						</div>
					)}
				</TabsContent>
			</Tabs>
		</PageShell>
	);
}
