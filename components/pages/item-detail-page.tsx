'use client';

// Item detail with edit modal, borrow/queue actions
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
	ArrowLeft,
	MessageCircle,
	Calendar as CalendarIcon,
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
	CalendarPlus,
	Scale,
	DollarSign,
	Archive,
	ArchiveRestore,
	Trash2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { ItemCard } from '@/components/cards/item-card';
import { EditItemModal } from '@/components/modals/edit-item-modal';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import { useGetItemQuery, useUpdateItemMutation, useDeleteItemMutation, Item } from '@/lib/redux/api/itemsApi';
import { useGetUserQuery } from '@/lib/redux/api/userApi';
import { formatWeight, defaultWeightUnit, isApparelOrShoes, type WeightUnit } from '@/lib/units';
import {
	useCreateBorrowRequestMutation,
	useGetBorrowRequestsQuery,
	useGetQueueEntriesQuery,
	useGetTransactionsQuery,
	useExtendBorrowMutation,
	useConfirmHandoffMutation,
	useConfirmReceiptMutation,
	useMarkAsReturnedMutation,
	useConfirmReturnMutation,
} from '@/lib/redux/api/borrowApi';
import { PageShell } from '@/components/ui/page';
import { isBorrowOverdue } from '@/lib/borrow-ui';
import { ItemDetailSkeleton } from '@/components/ui/skeletons';
import { useToast } from '@/hooks/useToast';
import { openDirectChat } from '@/lib/chat-navigation';

interface ItemDetailPageProps {
	itemId: string;
}

// Extend-borrow is disabled for MVP. Flip to true to re-enable the feature
// (the dialog + API route are left intact behind this flag).
const EXTEND_ENABLED = false;

export function ItemDetailPage({ itemId }: ItemDetailPageProps) {
	const router = useRouter();
	const { toast } = useToast();
	const [copied, setCopied] = useState(false);
	const [isStartingChat, setIsStartingChat] = useState(false);
	const [showBorrowModal, setShowBorrowModal] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [showExtendModal, setShowExtendModal] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const [isArchiving, setIsArchiving] = useState(false);
	const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined);
	const [borrowMessage, setBorrowMessage] = useState('');
	const [borrowEvent, setBorrowEvent] = useState('');
	const [desiredFrom, setDesiredFrom] = useState<Date | undefined>(undefined);
	const [desiredTo, setDesiredTo] = useState<Date | undefined>(undefined);

	const { data: item, isLoading, error, refetch: refetchItem } = useGetItemQuery(itemId);
	const { data: currentUser } = useGetUserQuery();
	const [updateItem, { isLoading: isUpdatingItem }] = useUpdateItemMutation();
	const [deleteItem, { isLoading: isDeletingItem }] = useDeleteItemMutation();

	// Weight unit: default from the user's country (US → lbs), with a manual toggle. Display-only; kg is canonical.
	const [weightUnit, setWeightUnit] = useState<WeightUnit | null>(null);
	const resolvedWeightUnit: WeightUnit = weightUnit ?? defaultWeightUnit(currentUser?.countryCode);

	// Get existing borrow requests and queue for this item
	const { data: existingRequests = [] } = useGetBorrowRequestsQuery({ itemId, type: 'outgoing' }, { skip: !itemId });
	const { data: queueEntries = [] } = useGetQueueEntriesQuery({ itemId }, { skip: !itemId });
	// Get user's active transactions for this item
	const { data: borrowerTransactions = [] } = useGetTransactionsQuery(
		{ role: 'borrower', itemId },
		{ skip: !itemId },
	);

	// Borrow/extend mutations
	const [createBorrowRequest, { isLoading: isCreatingRequest }] = useCreateBorrowRequestMutation();
	const [extendBorrow, { isLoading: isExtending }] = useExtendBorrowMutation();

	// Borrow lifecycle mutations — surfaced inline so actions live where the item is viewed,
	// not only on the Activity screen.
	const [confirmHandoff] = useConfirmHandoffMutation();
	const [confirmReceipt] = useConfirmReceiptMutation();
	const [markAsReturned] = useMarkAsReturnedMutation();
	const [confirmReturn] = useConfirmReturnMutation();
	const [processingAction, setProcessingAction] = useState(false);

	const runLifecycleAction = async (
		action: () => Promise<unknown>,
		success: { title: string; description?: string },
		fallbackError: string,
	) => {
		setProcessingAction(true);
		try {
			await action();
			toast({ title: success.title, description: success.description });
		} catch (error) {
			const msg =
				error && typeof error === 'object' && 'data' in error
					? (error.data as { error?: string })?.error || fallbackError
					: fallbackError;
			toast({ title: msg, variant: 'destructive' });
		} finally {
			setProcessingAction(false);
		}
	};

	// Check if user already has a pending request
	const hasPendingRequest = existingRequests.some(r => r.status === 'PENDING');
	const isInQueue = queueEntries.some(q => q.status === 'WAITING' || q.status === 'READY');
	const queuePosition = queueEntries.find(q => q.status === 'WAITING')?.position;

	// Check if user is currently borrowing this item (all non-completed active statuses)
	const activeTransaction = borrowerTransactions.find(
		t =>
			t.item.id === itemId &&
			['ACTIVE', 'LENDER_CONFIRMED', 'BORROWER_CONFIRMED', 'RETURN_PENDING'].includes(t.status),
	);
	const isCurrentBorrower = !!activeTransaction;

	// Item with availability info (cast since API returns isAvailable)
	const itemWithAvailability = item as (Item & { isAvailable?: boolean }) | undefined;

	// Active borrow/reservation on this item. A booking whose start date is still in the
	// future is a "reservation" (shown distinctly from a currently-borrowed item).
	const activeBorrow = item?.activeBorrow ?? null;
	const isReservedFuture = activeBorrow?.startAt ? new Date(activeBorrow.startAt) > new Date() : false;
	const formatShortDate = (d: string) =>
		new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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
		router.back();
	};

	const handleStartChat = async () => {
		if (!item?.owner?.id || item.isOwner) return;
		setIsStartingChat(true);
		try {
			await openDirectChat(router, {
				otherUserId: item.owner.id,
				contextRef: { type: 'item', id: item.id, title: item.name },
			});
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

	const handleExtend = async () => {
		if (!newDueDate) {
			toast({ title: 'Please select a new due date', variant: 'destructive' });
			return;
		}
		if (!activeTransaction?.borrowRequestId) {
			toast({ title: 'Unable to extend: transaction info missing', variant: 'destructive' });
			return;
		}
		try {
			const newDueDateStr = format(newDueDate, 'yyyy-MM-dd');
			await extendBorrow({ id: activeTransaction.borrowRequestId, newDueAt: newDueDateStr }).unwrap();
			toast({
				title: 'Borrow period extended!',
				description: `New due date: ${newDueDate.toLocaleDateString()}`,
			});
			setShowExtendModal(false);
			setNewDueDate(undefined);
		} catch (error) {
			const msg =
				error && typeof error === 'object' && 'data' in error
					? (error.data as { error?: string })?.error || 'Failed to extend'
					: 'Failed to extend borrow period';
			toast({ title: 'Extension not allowed', description: msg, variant: 'destructive' });
		}
	};

	const handleBorrowRequest = async (joinQueue = false) => {
		if (!desiredFrom || !desiredTo) {
			toast({ title: 'Please select dates', variant: 'destructive' });
			return;
		}
		if (isBefore(startOfDay(desiredTo), startOfDay(desiredFrom))) {
			toast({ title: '"To" date must be on or after "From" date', variant: 'destructive' });
			return;
		}
		try {
			const result = await createBorrowRequest({
				itemId,
				message: borrowMessage.trim() || undefined,
				event: borrowEvent.trim() || undefined,
				desiredFrom: format(desiredFrom, 'yyyy-MM-dd'),
				desiredTo: format(desiredTo, 'yyyy-MM-dd'),
				joinQueue,
			}).unwrap();

			// Close modal and reset state immediately on success
			setShowBorrowModal(false);
			setBorrowMessage('');
			setBorrowEvent('');
			setDesiredFrom(undefined);
			setDesiredTo(undefined);

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
			const errorMessage =
				error && typeof error === 'object' && 'data' in error
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

	const handleArchiveToggle = async () => {
		if (!item) return;
		const archived = !item.archivedAt;
		setIsArchiving(true);
		try {
			await updateItem({ id: item.id, archived }).unwrap();
			toast({
				title: archived ? 'Item archived' : 'Item restored',
				description: archived ? `${item.name} moved to archived.` : `${item.name} is active again.`,
			});
			refetchItem();
		} catch {
			toast({ title: 'Unable to update listing', description: 'Please try again.', variant: 'destructive' });
		} finally {
			setIsArchiving(false);
		}
	};

	const handleDelete = async () => {
		if (!item) return;
		try {
			await deleteItem({ id: item.id, circleIds: item.circles.map(c => c.id) }).unwrap();
			toast({ title: 'Item deleted', description: `${item.name} has been permanently deleted.` });
			router.push('/listings');
		} catch (error) {
			const msg =
				error && typeof error === 'object' && 'data' in error
					? (error.data as { error?: string })?.error
					: undefined;
			toast({
				title: 'Cannot delete item',
				description: msg ?? 'Please try again.',
				variant: 'destructive',
			});
		} finally {
			setShowDeleteDialog(false);
		}
	};

	const handleToggleValueVisibility = async () => {
		if (!item) return;
		const next = !item.isValueVisible;
		try {
			await updateItem({ id: item.id, isValueVisible: next }).unwrap();
			toast({
				title: next ? 'Price visible to borrowers' : 'Price hidden from borrowers',
			});
			refetchItem();
		} catch {
			toast({ title: 'Unable to update visibility', description: 'Please try again.', variant: 'destructive' });
		}
	};

	// Set default dates when modal opens
	useEffect(() => {
		if (showBorrowModal) {
			const today = startOfDay(new Date());
			setDesiredFrom(today);
			setDesiredTo(addDays(today, 7));
		}
	}, [showBorrowModal]);

	// Loading state
	if (isLoading) {
		return <ItemDetailSkeleton />;
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
							You don&apos;t have access to this item. You must be a member of the circle this item
							belongs to.
						</p>
						<div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
							<Button
								onClick={() => {
									toast({
										title: 'Access request logged',
										description: 'This feature is coming soon.',
									});
								}}
							>
								Request Access
							</Button>
							<Button variant="outline" onClick={() => router.push('/browse')} className="gap-2">
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
						<Button variant="outline" onClick={() => router.push('/browse')} className="gap-2">
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
							<p className="mt-2 text-muted-foreground leading-relaxed">{item.description}</p>
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

					{/* Weight — always visible, with kg/lbs toggle (defaults to the user's locale) */}
					{item.estimatedWeightKg != null && (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Scale className="h-4 w-4 flex-shrink-0" />
							<span>~{formatWeight(item.estimatedWeightKg, resolvedWeightUnit)}</span>
							<button
								type="button"
								onClick={() => setWeightUnit(resolvedWeightUnit === 'kg' ? 'lbs' : 'kg')}
								className="text-xs font-medium text-primary hover:underline"
							>
								Show in {resolvedWeightUnit === 'kg' ? 'lbs' : 'kg'}
							</button>
						</div>
					)}

					{/* Apparel/shoes: size isn't captured, so point borrowers to the owner */}
					{isApparelOrShoes(item.categories) && (
						<p className="text-xs text-muted-foreground">
							For size and other details please check with owner.
						</p>
					)}

					{/* Price — owner always sees it; others only if isValueVisible */}
					{item.estimatedNewPriceUsd != null && (item.isOwner || item.isValueVisible) && (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<DollarSign className="h-4 w-4 flex-shrink-0" />
							<span>Est. retail value: ${item.estimatedNewPriceUsd?.toLocaleString()}</span>
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
							<p className="text-sm font-semibold leading-tight">{item.owner.name || 'Unknown'}</p>
							<div className="flex items-center gap-1 text-xs text-muted-foreground">
								<CalendarIcon className="h-3 w-3" />
								<span>Added {formatDate(item.createdAt)}</span>
							</div>
						</div>
					</div>

					{/* Availability Status */}
					{!item.isOwner && (
						<div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
							{isCurrentBorrower ? (
								<>
									{activeTransaction &&
									isBorrowOverdue(activeTransaction.dueAt, activeTransaction.status) ? (
										<AlertCircle className="h-5 w-5 text-destructive" />
									) : (
										<CheckCircle2 className="h-5 w-5 text-primary" />
									)}
									<div>
										<p className="text-sm font-medium text-primary">You&apos;re borrowing this</p>
										<p className="text-xs text-muted-foreground">
											{activeTransaction?.status === 'RETURN_PENDING'
												? 'Return pending owner confirmation'
												: activeTransaction?.status === 'LENDER_CONFIRMED'
													? 'In transit — confirm when you receive it'
													: activeTransaction?.status === 'BORROWER_CONFIRMED'
														? `Received — due ${new Date(activeTransaction.dueAt).toLocaleDateString()}`
														: `Due ${new Date(activeTransaction!.dueAt).toLocaleDateString()}`}
										</p>
										{activeTransaction &&
											isBorrowOverdue(activeTransaction.dueAt, activeTransaction.status) && (
												<p className="text-xs font-medium text-destructive">
													Overdue — please return it as soon as you can.
												</p>
											)}
									</div>
								</>
							) : itemWithAvailability?.isAvailable !== false ? (
								<>
									<CheckCircle2 className="h-5 w-5 text-green-500" />
									<div>
										<p className="text-sm font-medium text-green-700 dark:text-green-400">
											Available
										</p>
										<p className="text-xs text-muted-foreground">Ready to borrow</p>
									</div>
								</>
							) : (
								<>
									<AlertCircle className="h-5 w-5 text-amber-500" />
									<div className="flex-1">
										<p className="text-sm font-medium text-amber-700 dark:text-amber-400">
											{isReservedFuture ? 'Reserved' : 'Currently Borrowed'}
										</p>
										<p className="text-xs text-muted-foreground">
											{isReservedFuture && activeBorrow?.startAt
												? `Reserved ${formatShortDate(activeBorrow.startAt)} – ${formatShortDate(activeBorrow.dueAt)}`
												: itemWithAvailability?.borrowedUntil
													? `Until ${formatShortDate(itemWithAvailability.borrowedUntil)}`
													: queueEntries.length > 0
														? `${queueEntries.length} ${queueEntries.length === 1 ? 'person' : 'people'} in queue`
														: 'You can join the queue'}
										</p>
									</div>
								</>
							)}
						</div>
					)}

					{/* Owner view: who has this item + whether it's reserved for later or borrowed now.
					    Previously only visible on My Activity — now surfaced on the item page too. */}
					{item.isOwner && activeBorrow && (
						<div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
							<Avatar className="h-9 w-9">
								<AvatarImage src={activeBorrow.borrowerImage || undefined} />
								<AvatarFallback className="text-xs">
									{activeBorrow.borrowerName?.[0]?.toUpperCase() || '?'}
								</AvatarFallback>
							</Avatar>
							<div className="flex-1">
								<p className="text-sm font-medium text-amber-700 dark:text-amber-400">
									{isReservedFuture
										? `Reserved by ${activeBorrow.borrowerName || 'a member'}`
										: `Borrowed by ${activeBorrow.borrowerName || 'a member'}`}
								</p>
								<p className="text-xs text-muted-foreground">
									{isReservedFuture && activeBorrow.startAt
										? `${formatShortDate(activeBorrow.startAt)} – ${formatShortDate(activeBorrow.dueAt)}`
										: activeBorrow.status === 'RETURN_PENDING'
											? 'Return pending your confirmation'
											: activeBorrow.status === 'LENDER_CONFIRMED'
												? 'Handed off — awaiting their confirmation'
												: `Due ${formatShortDate(activeBorrow.dueAt)}`}
								</p>
							</div>
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

					{/* Owner: price visibility toggle */}
					{item.isOwner && item.estimatedNewPriceUsd != null && (
						<div className="flex items-center gap-2">
							{isUpdatingItem ? (
								<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
							) : (
								<Switch
									id="value-visibility"
									checked={item.isValueVisible}
									onCheckedChange={handleToggleValueVisibility}
									disabled={isUpdatingItem}
								/>
							)}
							<label
								htmlFor="value-visibility"
								className="text-sm text-muted-foreground cursor-pointer select-none"
							>
								{item.isValueVisible ? 'Price visible to borrowers' : 'Price hidden from borrowers'}
							</label>
						</div>
					)}

					{/* Action Buttons */}
					<div className="flex flex-wrap gap-3 pt-2">
						{item.isOwner ? (
							<>
								<Button
									variant="outline"
									size="sm"
									className="gap-2 bg-transparent"
									onClick={() => setShowEditModal(true)}
								>
									<Pencil className="h-4 w-4" />
									Edit listing
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="gap-2 bg-transparent"
									onClick={handleArchiveToggle}
									disabled={isArchiving}
								>
									{isArchiving ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : item.archivedAt ? (
										<ArchiveRestore className="h-4 w-4" />
									) : (
										<Archive className="h-4 w-4" />
									)}
									{item.archivedAt ? 'Unarchive' : 'Archive'}
								</Button>
								<Button
									variant="outline"
									size="sm"
									className="gap-2 bg-transparent text-destructive hover:text-destructive"
									onClick={() => setShowDeleteDialog(true)}
								>
									<Trash2 className="h-4 w-4" />
									Delete
								</Button>
								{activeBorrow?.borrowRequestId && activeBorrow.status === 'ACTIVE' && (
									<Button
										className="gap-2"
										disabled={processingAction}
										onClick={() =>
											runLifecycleAction(
												() => confirmHandoff(activeBorrow.borrowRequestId).unwrap(),
												{
													title: 'Handoff confirmed!',
													description: 'Borrower has been notified.',
												},
												'Failed to confirm handoff',
											)
										}
									>
										{processingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
										Confirm Item Handed Off
									</Button>
								)}
								{activeBorrow?.borrowRequestId && activeBorrow.status === 'RETURN_PENDING' && (
									<Button
										className="gap-2"
										disabled={processingAction}
										onClick={() =>
											runLifecycleAction(
												() => confirmReturn(activeBorrow.borrowRequestId).unwrap(),
												{ title: 'Return confirmed!', description: 'Transaction completed.' },
												'Failed to confirm return',
											)
										}
									>
										{processingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
										Confirm Return
									</Button>
								)}
							</>
						) : (
							<Button
								variant="outline"
								className="gap-2 bg-transparent"
								data-testid="chat-with-owner-btn"
								onClick={handleStartChat}
								disabled={isStartingChat}
							>
								{isStartingChat ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<MessageCircle className="h-4 w-4" />
								)}
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
						{isCurrentBorrower && activeTransaction?.status === 'LENDER_CONFIRMED' && (
							<Button
								className="gap-2"
								disabled={processingAction}
								onClick={() =>
									runLifecycleAction(
										() => confirmReceipt(activeTransaction.borrowRequestId).unwrap(),
										{ title: 'Receipt confirmed!', description: 'Lender has been notified.' },
										'Failed to confirm receipt',
									)
								}
							>
								{processingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
								Confirm Item Received
							</Button>
						)}
						{isCurrentBorrower && activeTransaction?.status === 'BORROWER_CONFIRMED' && (
							<Button
								className="gap-2"
								disabled={processingAction}
								onClick={() =>
									runLifecycleAction(
										() => markAsReturned({ id: activeTransaction.borrowRequestId }).unwrap(),
										{ title: 'Marked as returned', description: 'Waiting for owner confirmation.' },
										'Failed to mark as returned',
									)
								}
							>
								{processingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
								Mark as Returned
							</Button>
						)}
						{isCurrentBorrower && (
							<Button variant="secondary" onClick={() => router.push('/activity')}>
								View in My Activity
							</Button>
						)}
						{EXTEND_ENABLED &&
							isCurrentBorrower &&
							activeTransaction &&
							['ACTIVE', 'LENDER_CONFIRMED', 'BORROWER_CONFIRMED'].includes(activeTransaction.status) && (
								<Button
									variant="outline"
									className="gap-2 bg-transparent"
									onClick={() => setShowExtendModal(true)}
								>
									<CalendarPlus className="h-4 w-4" />
									Extend Borrow
								</Button>
							)}
					</div>
				</div>
			</div>

			{/* Delete Confirmation Dialog */}
			<Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Delete Item</DialogTitle>
						<DialogDescription>
							Delete &ldquo;{item.name}&rdquo; permanently? This cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter className="gap-2 sm:gap-0">
						<Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isDeletingItem}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDelete} disabled={isDeletingItem}>
							{isDeletingItem ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Deleting...
								</>
							) : (
								'Delete permanently'
							)}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

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
								: `This item is currently borrowed. Join the queue to be notified when it's available.`}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>From</Label>
								<DatePicker
									value={desiredFrom}
									onChange={date => {
										if (!date) return;
										setDesiredFrom(date);
										if (!desiredTo || isBefore(desiredTo, date)) {
											setDesiredTo(addDays(date, 1));
										}
									}}
									disabled={{ before: startOfDay(new Date()) }}
									placeholder="Pick a date"
								/>
							</div>
							<div className="space-y-2">
								<Label>To</Label>
								<DatePicker
									value={desiredTo}
									onChange={date => date && setDesiredTo(date)}
									disabled={{
										before: desiredFrom ? startOfDay(desiredFrom) : startOfDay(new Date()),
									}}
									placeholder="Pick a date"
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="event">What&apos;s it for? (optional)</Label>
							<Input
								id="event"
								placeholder="e.g. Wedding, Camping trip, Birthday party"
								value={borrowEvent}
								onChange={e => setBorrowEvent(e.target.value)}
								maxLength={100}
							/>
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
							{isCreatingRequest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
							{itemWithAvailability?.isAvailable !== false ? 'Send Request' : 'Join Queue'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			{/* Extend Borrow Dialog */}
			<Dialog open={showExtendModal} onOpenChange={setShowExtendModal}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Extend Borrow Period</DialogTitle>
						<DialogDescription>
							Choose a new due date for &ldquo;{item.name}&rdquo;. Extension is only available if no one
							else has an approved request or is next in queue.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-4">
						<div className="space-y-2">
							<Label>New due date</Label>
							<DatePicker
								value={newDueDate}
								onChange={date => date && setNewDueDate(date)}
								disabled={{
									before: activeTransaction?.dueAt
										? startOfDay(new Date(activeTransaction.dueAt))
										: startOfDay(new Date()),
								}}
								placeholder="Pick a date"
							/>
						</div>
						{activeTransaction?.dueAt && (
							<p className="text-xs text-muted-foreground">
								Current due date: {new Date(activeTransaction.dueAt).toLocaleDateString()}
							</p>
						)}
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowExtendModal(false)}>
							Cancel
						</Button>
						<Button onClick={handleExtend} disabled={isExtending || !newDueDate} className="gap-2">
							{isExtending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<CalendarPlus className="h-4 w-4" />
							)}
							Confirm Extension
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
