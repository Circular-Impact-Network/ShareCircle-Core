'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
	Package,
	Clock,
	Loader2,
	ArrowUpRight,
	RotateCcw,
	Users,
	HandshakeIcon,
	History,
	CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, PageShell } from '@/components/ui/page';
import {
	useGetBorrowRequestsQuery,
	useGetQueueEntriesQuery,
	useGetTransactionsQuery,
	useMarkAsReturnedMutation,
	BorrowRequest,
	BorrowQueueEntry,
	FullTransaction,
} from '@/lib/redux/api/borrowApi';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type TabType = 'active' | 'pending' | 'queue' | 'history';

function getStatusBadge(status: string) {
	switch (status) {
		case 'PENDING':
			return <Badge variant="secondary">Pending Approval</Badge>;
		case 'APPROVED':
			return <Badge variant="default">Approved</Badge>;
		case 'DECLINED':
			return <Badge variant="destructive">Declined</Badge>;
		case 'ACTIVE':
			return <Badge className="bg-green-500 hover:bg-green-500">Currently Borrowed</Badge>;
		case 'RETURN_PENDING':
			return <Badge variant="secondary">Return Pending</Badge>;
		case 'COMPLETED':
			return <Badge variant="outline">Returned</Badge>;
		case 'WAITING':
			return <Badge variant="secondary">In Queue</Badge>;
		case 'READY':
			return <Badge className="bg-green-500 hover:bg-green-500">Ready to Request</Badge>;
		default:
			return <Badge variant="outline">{status}</Badge>;
	}
}

// Active transaction card (currently borrowed/lent)
function ActiveTransactionCard({
	transaction,
	role,
	onMarkReturned,
	isLoading,
}: {
	transaction: FullTransaction;
	role: 'borrower' | 'owner';
	onMarkReturned?: (id: string) => void;
	isLoading?: boolean;
}) {
	const router = useRouter();
	const isActive = transaction.status === 'ACTIVE';
	const isReturnPending = transaction.status === 'RETURN_PENDING';
	const otherPerson = role === 'borrower' ? transaction.owner : transaction.borrower;

	return (
		<Card data-testid="transaction-card" data-status={transaction.status}>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					{transaction.item.imageUrl && (
						<div
							className="h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-muted cursor-pointer"
							onClick={() => router.push(`/items/${transaction.item.id}`)}
						>
							<img src={transaction.item.imageUrl} alt={transaction.item.name} className="h-full w-full object-cover" />
						</div>
					)}
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1 flex-wrap">
							<p
								className="text-sm font-medium truncate cursor-pointer hover:underline"
								onClick={() => router.push(`/items/${transaction.item.id}`)}
							>
								{transaction.item.name}
							</p>
							{getStatusBadge(transaction.status)}
						</div>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<span>{role === 'borrower' ? 'From:' : 'To:'}</span>
							<Avatar className="h-5 w-5">
								<AvatarImage src={otherPerson?.image || undefined} />
								<AvatarFallback className="text-[10px]">
									{otherPerson?.name?.[0]?.toUpperCase() || '?'}
								</AvatarFallback>
							</Avatar>
							<span className="truncate">{otherPerson?.name || 'Unknown'}</span>
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Due: {new Date(transaction.dueAt).toLocaleDateString()}
						</p>

						{/* Actions based on role and status */}
						{role === 'borrower' && isActive && onMarkReturned && (
							<Button
								size="sm"
								variant="outline"
								className="mt-3 w-full gap-2"
								onClick={() => onMarkReturned(transaction.borrowRequestId)}
								disabled={isLoading}
							>
								{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
								Mark as Returned
							</Button>
						)}
						{role === 'borrower' && isReturnPending && (
							<p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
								Waiting for owner to confirm return
							</p>
						)}
						{role === 'owner' && isReturnPending && (
							<Button
								size="sm"
								className="mt-3 w-full"
								onClick={() => router.push('/notifications?tab=requests')}
							>
								Confirm Return
							</Button>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

// Pending request card
function PendingRequestCard({ request }: { request: BorrowRequest }) {
	const router = useRouter();

	return (
		<Card data-testid="pending-request-card" data-status={request.status}>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					{request.item.imageUrl && (
						<div
							className="h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-muted cursor-pointer"
							onClick={() => router.push(`/items/${request.item.id}`)}
						>
							<img src={request.item.imageUrl} alt={request.item.name} className="h-full w-full object-cover" />
						</div>
					)}
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1 flex-wrap">
							<p className="text-sm font-medium truncate">{request.item.name}</p>
							{getStatusBadge(request.status)}
						</div>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<span>From:</span>
							<Avatar className="h-5 w-5">
								<AvatarImage src={request.owner?.image || undefined} />
								<AvatarFallback className="text-[10px]">
									{request.owner?.name?.[0]?.toUpperCase() || '?'}
								</AvatarFallback>
							</Avatar>
							<span className="truncate">{request.owner?.name || 'Unknown'}</span>
						</div>
						<p className="text-xs text-muted-foreground mt-1">
							Requested: {new Date(request.desiredFrom).toLocaleDateString()} - {new Date(request.desiredTo).toLocaleDateString()}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

// Queue entry card
function QueueEntryCard({ entry }: { entry: BorrowQueueEntry }) {
	const router = useRouter();
	const isReady = entry.status === 'READY';

	return (
		<Card className={isReady ? 'border-green-500/50 bg-green-500/5' : ''} data-testid="queue-entry-card" data-status={entry.status}>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					{entry.item.imageUrl && (
						<div
							className="h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-muted cursor-pointer"
							onClick={() => router.push(`/items/${entry.item.id}`)}
						>
							<img src={entry.item.imageUrl} alt={entry.item.name} className="h-full w-full object-cover" />
						</div>
					)}
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1 flex-wrap">
							<p className="text-sm font-medium truncate">{entry.item.name}</p>
							{getStatusBadge(entry.status)}
							{entry.status === 'WAITING' && <Badge variant="outline">Position #{entry.position}</Badge>}
						</div>
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<span>Owner:</span>
							<Avatar className="h-5 w-5">
								<AvatarImage src={entry.item.owner?.image || undefined} />
								<AvatarFallback className="text-[10px]">
									{entry.item.owner?.name?.[0]?.toUpperCase() || '?'}
								</AvatarFallback>
							</Avatar>
							<span className="truncate">{entry.item.owner?.name || 'Unknown'}</span>
						</div>
						{isReady && (
							<Button size="sm" className="mt-3 w-full" onClick={() => router.push(`/items/${entry.item.id}`)}>
								Request Now
							</Button>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

// History transaction card
function HistoryTransactionCard({ transaction, role }: { transaction: FullTransaction; role: 'borrower' | 'owner' }) {
	const router = useRouter();
	const otherPerson = role === 'borrower' ? transaction.owner : transaction.borrower;

	return (
		<Card className="opacity-80">
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					{transaction.item.imageUrl && (
						<div
							className="h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-muted cursor-pointer"
							onClick={() => router.push(`/items/${transaction.item.id}`)}
						>
							<img src={transaction.item.imageUrl} alt={transaction.item.name} className="h-full w-full object-cover" />
						</div>
					)}
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1 flex-wrap">
							<p className="text-sm font-medium truncate">{transaction.item.name}</p>
							<Badge variant="outline" className="gap-1">
								<CheckCircle2 className="h-3 w-3" />
								Returned
							</Badge>
						</div>
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<span>{role === 'borrower' ? 'Borrowed from' : 'Lent to'}:</span>
							<span className="truncate">{otherPerson?.name || 'Unknown'}</span>
						</div>
						<p className="text-xs text-muted-foreground">
							{transaction.returnedAt && `Returned ${new Date(transaction.returnedAt).toLocaleDateString()}`}
						</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export function MyActivityPage() {
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState<TabType>('active');
	const [processingId, setProcessingId] = useState<string | null>(null);

	// Fetch data
	const { data: outgoingRequests = [], isLoading: requestsLoading } = useGetBorrowRequestsQuery({
		type: 'outgoing',
	});
	const { data: borrowerTransactions = [], isLoading: borrowerTxLoading } = useGetTransactionsQuery({
		role: 'borrower',
	});
	const { data: ownerTransactions = [], isLoading: ownerTxLoading } = useGetTransactionsQuery({
		role: 'owner',
	});
	const { data: queueEntries = [], isLoading: queueLoading } = useGetQueueEntriesQuery({
		myEntries: true,
	});

	// Mark as returned mutation
	const [markAsReturned] = useMarkAsReturnedMutation();

	const handleMarkReturned = async (requestId: string) => {
		setProcessingId(requestId);
		try {
			await markAsReturned({ id: requestId }).unwrap();
			toast({ title: 'Marked as returned', description: 'Waiting for owner confirmation.' });
		} catch {
			toast({ title: 'Failed to mark as returned', variant: 'destructive' });
		} finally {
			setProcessingId(null);
		}
	};

	// Filter data
	// Active = currently borrowed/lent (ACTIVE or RETURN_PENDING transactions)
	const activeBorrowed = borrowerTransactions.filter(t => t.status === 'ACTIVE' || t.status === 'RETURN_PENDING');
	const activeLent = ownerTransactions.filter(t => t.status === 'ACTIVE' || t.status === 'RETURN_PENDING');
	const activeCount = activeBorrowed.length + activeLent.length;

	// Pending = pending approval requests (only PENDING status)
	const pendingRequests = outgoingRequests.filter(r => r.status === 'PENDING');

	// Queue = waiting or ready
	const activeQueueEntries = queueEntries.filter(q => q.status === 'WAITING' || q.status === 'READY');

	// History = completed transactions
	const borrowedHistory = borrowerTransactions.filter(t => t.status === 'COMPLETED');
	const lentHistory = ownerTransactions.filter(t => t.status === 'COMPLETED');

	const isLoading = requestsLoading || borrowerTxLoading || ownerTxLoading || queueLoading;

	return (
		<PageShell className="space-y-6">
			<PageHeader title="My Activity" description="Track your borrowing and lending activity" />

			<Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabType)} className="w-full">
				<TabsList className="mb-4 flex-wrap h-auto gap-1">
					<TabsTrigger value="active" className="gap-2">
						<HandshakeIcon className="h-4 w-4" />
						Active
						{activeCount > 0 && (
							<Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
								{activeCount}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="pending" className="gap-2">
						<Clock className="h-4 w-4" />
						Pending
						{pendingRequests.length > 0 && (
							<Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
								{pendingRequests.length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="queue" className="gap-2">
						<Users className="h-4 w-4" />
						Queue
						{activeQueueEntries.length > 0 && (
							<Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-xs">
								{activeQueueEntries.length}
							</Badge>
						)}
					</TabsTrigger>
					<TabsTrigger value="history" className="gap-2">
						<History className="h-4 w-4" />
						History
					</TabsTrigger>
				</TabsList>

				{/* Active Tab - Currently borrowed/lent items */}
				<TabsContent value="active" className="space-y-4">
					{isLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
					) : activeCount === 0 ? (
						<Card className="border-dashed">
							<CardContent className="flex flex-col items-center gap-4 text-center py-12">
								<div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
									<Package className="h-7 w-7 text-muted-foreground" />
								</div>
								<div>
									<p className="font-medium">No active items</p>
									<p className="text-sm text-muted-foreground">
										Items you&apos;re currently borrowing or lending will appear here
									</p>
								</div>
							</CardContent>
						</Card>
					) : (
						<>
							{/* Items I'm borrowing */}
							{activeBorrowed.length > 0 && (
								<div className="space-y-3">
									<h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
										<ArrowUpRight className="h-4 w-4 rotate-180" />
										Items I&apos;m Borrowing ({activeBorrowed.length})
									</h3>
									{activeBorrowed.map(tx => (
										<ActiveTransactionCard
											key={tx.id}
											transaction={tx}
											role="borrower"
											onMarkReturned={handleMarkReturned}
											isLoading={processingId === tx.borrowRequestId}
										/>
									))}
								</div>
							)}

							{/* Items I've lent out */}
							{activeLent.length > 0 && (
								<div className="space-y-3">
									<h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
										<ArrowUpRight className="h-4 w-4" />
										Items I&apos;ve Lent Out ({activeLent.length})
									</h3>
									{activeLent.map(tx => (
										<ActiveTransactionCard key={tx.id} transaction={tx} role="owner" />
									))}
								</div>
							)}
						</>
					)}
				</TabsContent>

				{/* Pending Tab - Requests awaiting approval */}
				<TabsContent value="pending" className="space-y-3">
					{requestsLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
					) : pendingRequests.length === 0 ? (
						<Card className="border-dashed">
							<CardContent className="flex flex-col items-center gap-4 text-center py-12">
								<div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
									<Clock className="h-7 w-7 text-muted-foreground" />
								</div>
								<div>
									<p className="font-medium">No pending requests</p>
									<p className="text-sm text-muted-foreground">
										Borrow requests awaiting approval will appear here
									</p>
								</div>
							</CardContent>
						</Card>
					) : (
						pendingRequests.map(request => <PendingRequestCard key={request.id} request={request} />)
					)}
				</TabsContent>

				{/* Queue Tab */}
				<TabsContent value="queue" className="space-y-3">
					{queueLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
					) : activeQueueEntries.length === 0 ? (
						<Card className="border-dashed">
							<CardContent className="flex flex-col items-center gap-4 text-center py-12">
								<div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
									<Users className="h-7 w-7 text-muted-foreground" />
								</div>
								<div>
									<p className="font-medium">No queue entries</p>
									<p className="text-sm text-muted-foreground">
										When you join a queue for unavailable items, they&apos;ll appear here
									</p>
								</div>
							</CardContent>
						</Card>
					) : (
						activeQueueEntries.map(entry => <QueueEntryCard key={entry.id} entry={entry} />)
					)}
				</TabsContent>

				{/* History Tab */}
				<TabsContent value="history" className="space-y-4">
					{isLoading ? (
						<div className="flex items-center justify-center py-12">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
					) : borrowedHistory.length === 0 && lentHistory.length === 0 ? (
						<Card className="border-dashed">
							<CardContent className="flex flex-col items-center gap-4 text-center py-12">
								<div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
									<History className="h-7 w-7 text-muted-foreground" />
								</div>
								<div>
									<p className="font-medium">No history yet</p>
									<p className="text-sm text-muted-foreground">
										Completed transactions will appear here
									</p>
								</div>
							</CardContent>
						</Card>
					) : (
						<>
							{/* Borrowed history */}
							{borrowedHistory.length > 0 && (
								<div className="space-y-3">
									<h3 className="text-sm font-medium text-muted-foreground">
										Items I Borrowed ({borrowedHistory.length})
									</h3>
									{borrowedHistory.map(tx => (
										<HistoryTransactionCard key={tx.id} transaction={tx} role="borrower" />
									))}
								</div>
							)}

							{/* Lent history */}
							{lentHistory.length > 0 && (
								<div className="space-y-3">
									<h3 className="text-sm font-medium text-muted-foreground">
										Items I Lent ({lentHistory.length})
									</h3>
									{lentHistory.map(tx => (
										<HistoryTransactionCard key={tx.id} transaction={tx} role="owner" />
									))}
								</div>
							)}
						</>
					)}
				</TabsContent>
			</Tabs>
		</PageShell>
	);
}
