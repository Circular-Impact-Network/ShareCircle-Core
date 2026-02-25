'use client';

// Item detail with edit modal, borrow/queue actions
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
	ArrowLeft, 
	MessageCircle, 
	Calendar, 
	Tag, 
	FolderOpen, 
	Copy, 
	Check, 
	Loader2,
	Lock,
	X,
	Clock,
	Users,
	CheckCircle2,
	AlertCircle,
	Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { ItemCard } from '@/components/cards/item-card';
import { EditItemModal } from '@/components/modals/edit-item-modal';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { useGetItemQuery, Item } from '@/lib/redux/api/itemsApi';
import { 
	useCreateBorrowRequestMutation, 
	useGetBorrowRequestsQuery,
	useGetQueueEntriesQuery,
	useGetTransactionsQuery
} from '@/lib/redux/api/borrowApi';
import { PageShell } from '@/components/ui/page';
import { useToast } from '@/hooks/use-toast';

interface ItemDetailPageProps {
	itemId: string;
}

export function ItemDetailPage({ itemId }: ItemDetailPageProps) {
	const router = useRouter();
	const { toast } = useToast();
	const [copied, setCopied] = useState(false);
	const [isStartingChat, setIsStartingChat] = useState(false);
	const [showBorrowModal, setShowBorrowModal] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [borrowMessage, setBorrowMessage] = useState('');
	const [desiredFrom, setDesiredFrom] = useState('');
	const [desiredTo, setDesiredTo] = useState('');
	
	const { data: item, isLoading, error, refetch: refetchItem } = useGetItemQuery(itemId);
	
	// Get existing borrow requests and queue for this item
	const { data: existingRequests = [] } = useGetBorrowRequestsQuery(
		{ itemId, type: 'outgoing' },
		{ skip: !itemId }
	);
	const { data: queueEntries = [] } = useGetQueueEntriesQuery(
		{ itemId },
		{ skip: !itemId }
	);
	// Get user's active transactions for this item
	const { data: borrowerTransactions = [] } = useGetTransactionsQuery(
		{ role: 'borrower', itemId },
		{ skip: !itemId }
	);
	
	// Borrow request mutation
	const [createBorrowRequest, { isLoading: isCreatingRequest }] = useCreateBorrowRequestMutation();
	
	// Check if user already has a pending request
	const hasPendingRequest = existingRequests.some(r => r.status === 'PENDING');
	const isInQueue = queueEntries.some(q => q.status === 'WAITING' || q.status === 'READY');
	const queuePosition = queueEntries.find(q => q.status === 'WAITING')?.position;
	
	// Check if user is currently borrowing this item
	const activeTransaction = borrowerTransactions.find(
		t => t.item.id === itemId && (t.status === 'ACTIVE' || t.status === 'RETURN_PENDING')
	);
	const isCurrentBorrower = !!activeTransaction;
	
	// Item with availability info (cast since API returns isAvailable)
	const itemWithAvailability = item as (Item & { isAvailable?: boolean }) | undefined;

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
		});
	};

	const handleCopyLink = async () => {
		const url = `${window.location.origin}/items/${itemId}`;
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
			toast({
				title: 'Link copied!',
				description: 'Share this link with circle members.',
			});
		} catch {
			toast({
				title: 'Failed to copy',
				description: 'Please copy the URL manually.',
				variant: 'destructive',
			});
		}
	};

	const handleBack = () => {
		if (item?.isOwner) {
			router.push('/listings');
		} else {
			router.push('/browse');
		}
	};

	const handleStartChat = async () => {
		if (!item?.owner?.id || item.isOwner) return;
		setIsStartingChat(true);
		try {
			const response = await fetch('/api/messages/threads', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ otherUserId: item.owner.id }),
			});
			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || 'Failed to start chat');
			}
			const data = await response.json();
			router.push(`/messages/${data.id}`);
		} catch (error) {
			console.error('Start chat error:', error);
			toast({
				title: 'Unable to start chat',
				description: error instanceof Error ? error.message : 'Please try again.',
				variant: 'destructive',
			});
		} finally {
			setIsStartingChat(false);
		}
	};

	const handleBorrowRequest = async (joinQueue = false) => {
		if (!desiredFrom || !desiredTo) {
			toast({ title: 'Please select dates', variant: 'destructive' });
			return;
		}
		try {
			const result = await createBorrowRequest({
				itemId,
				message: borrowMessage.trim() || undefined,
				desiredFrom,
				desiredTo,
				joinQueue,
			}).unwrap();
			
			// Close modal and reset state immediately on success
			setShowBorrowModal(false);
			setBorrowMessage('');
			setDesiredFrom('');
			setDesiredTo('');
			
			if (result.type === 'queue') {
				toast({
					title: 'Added to queue!',
					description: 'You will be notified when the item is available.',
				});
			} else {
				toast({
					title: 'Request sent!',
					description: 'The owner will review your request.',
				});
			}
		} catch (error: unknown) {
			console.error('Borrow request error:', error);
			const errorMessage = error && typeof error === 'object' && 'data' in error
				? (error.data as { error?: string })?.error
				: 'Please try again.';
			toast({
				title: 'Failed to submit request',
				description: errorMessage,
				variant: 'destructive',
			});
			// Don't close modal on error so user can retry
		}
	};

	// Set default dates when modal opens
	useEffect(() => {
		if (showBorrowModal) {
			const today = new Date();
			const nextWeek = new Date(today);
			nextWeek.setDate(nextWeek.getDate() + 7);
			setDesiredFrom(today.toISOString().split('T')[0]);
			setDesiredTo(nextWeek.toISOString().split('T')[0]);
		}
	}, [showBorrowModal]);

	// Loading state
	if (isLoading) {
		return (
			<PageShell className="flex items-center justify-center min-h-[60vh]">
				<div className="text-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
					<p className="text-muted-foreground">Loading item details...</p>
				</div>
			</PageShell>
		);
	}

	// Access denied state (403)
	if (error && 'status' in error && error.status === 403) {
		return (
			<PageShell className="flex items-center justify-center min-h-[60vh]">
				<Card className="max-w-md w-full">
					<CardContent className="flex flex-col items-center text-center p-8">
						<div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
							<Lock className="h-8 w-8 text-destructive" />
						</div>
						<h2 className="text-xl font-semibold mb-2">Access Denied</h2>
						<p className="text-muted-foreground mb-6">
							You don&apos;t have access to this item. You must be a member of the circle this item belongs to.
						</p>
						<div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
							<Button 
								onClick={() => {
									console.log('[Access Request] User requested access to item:', itemId);
									toast({
										title: 'Access request logged',
										description: 'This feature is coming soon.',
									});
								}}
							>
								Request Access
							</Button>
							<Button 
								variant="outline" 
								onClick={() => router.push('/browse')}
								className="gap-2"
							>
								<ArrowLeft className="h-4 w-4" />
								Go to Browse
							</Button>
						</div>
					</CardContent>
				</Card>
			</PageShell>
		);
	}

	// Not found or other error
	if (error || !item) {
		return (
			<PageShell className="flex items-center justify-center min-h-[60vh]">
				<Card className="max-w-md w-full">
					<CardContent className="flex flex-col items-center text-center p-8">
						<div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
							<X className="h-8 w-8 text-muted-foreground" />
						</div>
						<h2 className="text-xl font-semibold mb-2">Item Not Found</h2>
						<p className="text-muted-foreground mb-6">
							This item doesn&apos;t exist or may have been deleted.
						</p>
						<Button 
							variant="outline" 
							onClick={() => router.push('/browse')}
							className="gap-2"
						>
							<ArrowLeft className="h-4 w-4" />
							Go to Browse
						</Button>
					</CardContent>
				</Card>
			</PageShell>
		);
	}

	return (
		<PageShell className="space-y-4 sm:space-y-6">
			{/* Main Content */}
			<div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
				{/* Image Section */}
				<div className="relative aspect-[4/3] sm:aspect-square overflow-hidden rounded-xl bg-muted group">
					<ItemCard item={item} variant="detail" className="aspect-auto h-full" />
				</div>

				{/* Details Section */}
				<div className="space-y-4 sm:space-y-6">
					{/* Title and Description */}
					<div className="space-y-2">
						<div className="flex items-start justify-between gap-4">
							<div className="flex items-center gap-3 min-w-0 flex-1">
								<Button onClick={handleBack} variant="ghost" size="icon" className="shrink-0 -ml-2">
									<ArrowLeft className="h-4 w-4" />
									<span className="sr-only">Back</span>
								</Button>
								<h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{item.name}</h1>
							</div>
							<Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-2 shrink-0">
								{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
								{copied ? 'Copied!' : 'Share'}
							</Button>
						</div>
						{item.description && (
							<p className="mt-2 text-muted-foreground leading-relaxed">
								{item.description}
							</p>
						)}
					</div>

					{/* Categories */}
					{item.categories && item.categories.length > 0 && (
						<div className="flex items-center gap-2 flex-wrap">
							<FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
							{item.categories.map(category => (
								<Badge key={category} variant="secondary">
									{category}
								</Badge>
							))}
						</div>
					)}

					{/* Tags */}
					{item.tags && item.tags.length > 0 && (
						<div className="flex items-center gap-2 flex-wrap">
							<Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
							<div className="flex flex-wrap gap-1.5">
								{item.tags.map(tag => (
									<Badge key={tag} variant="outline" className="text-xs">
										{tag}
									</Badge>
								))}
							</div>
						</div>
					)}

					{/* Shared in Circles */}
					{item.circles && item.circles.length > 0 && (
						<div className="text-sm text-muted-foreground">
							Shared in: {item.circles.map(c => c.name).join(', ')}
						</div>
					)}

					<Separator />

					{/* Owner Info */}
					<div className="flex items-center gap-3">
						<Avatar className="h-12 w-12">
							<AvatarImage src={item.owner.image || undefined} />
							<AvatarFallback className="text-sm">
								{item.owner.name?.[0]?.toUpperCase() || '?'}
							</AvatarFallback>
						</Avatar>
						<div className="space-y-0.5 flex-1">
							<p className="text-sm font-semibold leading-tight">
								{item.owner.name || 'Unknown'}
							</p>
							<div className="flex items-center gap-1 text-xs text-muted-foreground">
								<Calendar className="h-3 w-3" />
								<span>Added {formatDate(item.createdAt)}</span>
							</div>
						</div>
					</div>

					{/* Availability Status */}
					{!item.isOwner && (
						<div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
							{isCurrentBorrower ? (
								<>
									<CheckCircle2 className="h-5 w-5 text-primary" />
									<div>
										<p className="text-sm font-medium text-primary">You&apos;re borrowing this</p>
										<p className="text-xs text-muted-foreground">
											{activeTransaction?.status === 'RETURN_PENDING' 
												? 'Return pending confirmation'
												: `Due ${new Date(activeTransaction!.dueAt).toLocaleDateString()}`
											}
										</p>
									</div>
								</>
							) : itemWithAvailability?.isAvailable !== false ? (
								<>
									<CheckCircle2 className="h-5 w-5 text-green-500" />
									<div>
										<p className="text-sm font-medium text-green-700 dark:text-green-400">Available</p>
										<p className="text-xs text-muted-foreground">Ready to borrow</p>
									</div>
								</>
							) : (
								<>
									<AlertCircle className="h-5 w-5 text-amber-500" />
									<div className="flex-1">
										<p className="text-sm font-medium text-amber-700 dark:text-amber-400">Currently Borrowed</p>
										<p className="text-xs text-muted-foreground">
											{queueEntries.length > 0 
												? `${queueEntries.length} ${queueEntries.length === 1 ? 'person' : 'people'} in queue`
												: 'You can join the queue'
											}
										</p>
									</div>
								</>
							)}
						</div>
					)}

					{/* User's request status - only show if not currently borrowing */}
					{!isCurrentBorrower && hasPendingRequest && (
						<div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
							<Clock className="h-5 w-5 text-primary" />
							<div>
								<p className="text-sm font-medium">Request Pending</p>
								<p className="text-xs text-muted-foreground">Waiting for owner approval</p>
							</div>
						</div>
					)}
					{!isCurrentBorrower && isInQueue && (
						<div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
							<Users className="h-5 w-5 text-blue-500" />
							<div>
								<p className="text-sm font-medium text-blue-700 dark:text-blue-400">
									{queuePosition ? `#${queuePosition} in queue` : 'In queue'}
								</p>
								<p className="text-xs text-muted-foreground">You&apos;ll be notified when available</p>
							</div>
						</div>
					)}

					{/* Action Buttons */}
					<div className="flex flex-wrap gap-3 pt-2">
						{item.isOwner ? (
							<Button
								variant="outline"
								className="gap-2 bg-transparent"
								onClick={() => setShowEditModal(true)}
							>
								<Pencil className="h-4 w-4" />
								Edit listing
							</Button>
						) : (
							<Button
								variant="outline"
								className="gap-2 bg-transparent"
								onClick={handleStartChat}
								disabled={isStartingChat}
							>
								{isStartingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
								Chat with owner
							</Button>
						)}
						{!item.isOwner && !isCurrentBorrower && (
							<Button 
								className="min-w-36"
								onClick={() => setShowBorrowModal(true)}
								disabled={hasPendingRequest || isInQueue}
							>
								{itemWithAvailability?.isAvailable !== false ? 'Request to Borrow' : 'Join Queue'}
							</Button>
						)}
						{isCurrentBorrower && activeTransaction?.status === 'ACTIVE' && (
							<Button 
								variant="secondary"
								onClick={() => router.push('/activity')}
							>
								View in My Activity
							</Button>
						)}
					</div>
				</div>
			</div>

			{/* Borrow Request Modal */}
			<Dialog open={showBorrowModal} onOpenChange={setShowBorrowModal}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{itemWithAvailability?.isAvailable !== false ? 'Request to Borrow' : 'Join Queue'}
						</DialogTitle>
						<DialogDescription>
							{itemWithAvailability?.isAvailable !== false 
								? `Request to borrow "${item.name}" from ${item.owner.name || 'the owner'}`
								: `This item is currently borrowed. Join the queue to be notified when it's available.`
							}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label htmlFor="from-date">From</Label>
								<Input
									id="from-date"
									type="date"
									value={desiredFrom}
									onChange={e => setDesiredFrom(e.target.value)}
									min={new Date().toISOString().split('T')[0]}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="to-date">To</Label>
								<Input
									id="to-date"
									type="date"
									value={desiredTo}
									onChange={e => setDesiredTo(e.target.value)}
									min={desiredFrom || new Date().toISOString().split('T')[0]}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="message">Message (optional)</Label>
							<Textarea
								id="message"
								placeholder="Add a message to the owner..."
								value={borrowMessage}
								onChange={e => setBorrowMessage(e.target.value)}
								rows={3}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowBorrowModal(false)}>
							Cancel
						</Button>
						<Button 
							onClick={() => handleBorrowRequest(itemWithAvailability?.isAvailable === false)}
							disabled={isCreatingRequest || !desiredFrom || !desiredTo}
						>
							{isCreatingRequest ? (
								<Loader2 className="h-4 w-4 animate-spin mr-2" />
							) : null}
							{itemWithAvailability?.isAvailable !== false ? 'Send Request' : 'Join Queue'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<EditItemModal
				itemId={item.id}
				open={showEditModal}
				onOpenChange={setShowEditModal}
				onSuccess={() => {
					setShowEditModal(false);
					refetchItem();
				}}
			/>
		</PageShell>
	);
}
