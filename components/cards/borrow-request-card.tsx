'use client';

import { useRouter } from 'next/navigation';
import { Check, CheckCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { BorrowRequest } from '@/lib/redux/api/borrowApi';

interface BorrowRequestCardProps {
	request: BorrowRequest;
	onApprove: (id: string) => void;
	onDecline: (id: string) => void;
	onConfirmReturn: (id: string) => void;
	onConfirmHandoff: (id: string) => void;
	isLoading: boolean;
}

export function BorrowRequestCard({
	request,
	onApprove,
	onDecline,
	onConfirmReturn,
	onConfirmHandoff,
	isLoading,
}: BorrowRequestCardProps) {
	const router = useRouter();
	const isPending = request.status === 'PENDING';
	const isReturnPending = request.transaction?.status === 'RETURN_PENDING';
	const isActive = request.status === 'APPROVED' && request.transaction?.status === 'ACTIVE';
	const isLenderConfirmed = request.transaction?.status === 'LENDER_CONFIRMED';
	const isBorrowerConfirmed = request.transaction?.status === 'BORROWER_CONFIRMED';

	return (
		<Card>
			<CardContent className="p-4">
				<div className="flex items-start gap-3">
					{request.item.imageUrl && (
						<div
							className="h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-lg bg-muted"
							onClick={() => router.push(`/items/${request.item.id}`)}
						>
							<img
								src={request.item.imageUrl}
								alt={request.item.name}
								className="h-full w-full object-cover"
							/>
						</div>
					)}
					<div className="min-w-0 flex-1">
						<div className="mb-1 flex items-center gap-2">
							<p
								className="cursor-pointer truncate text-sm font-medium hover:underline"
								onClick={() => router.push(`/items/${request.item.id}`)}
							>
								{request.item.name}
							</p>
							<Badge
								variant={
									isPending
										? 'default'
										: isReturnPending
											? 'secondary'
											: isActive
												? 'default'
												: isLenderConfirmed
													? 'secondary'
													: 'outline'
								}
							>
								{isPending
									? 'Pending'
									: isReturnPending
										? 'Return Pending'
										: isActive
											? 'Borrow Approved'
											: isLenderConfirmed
												? 'Item Handed Off'
												: request.transaction?.status === 'BORROWER_CONFIRMED'
													? 'Item Received'
													: request.status}
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
							<p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
								&ldquo;{request.message}&rdquo;
							</p>
						)}
						<p className="mt-1 text-xs text-muted-foreground">
							{new Date(request.desiredFrom).toLocaleDateString()} -{' '}
							{new Date(request.desiredTo).toLocaleDateString()}
						</p>

						{isPending && (
							<div className="mt-3 flex flex-wrap gap-2">
								<Button
									size="sm"
									onClick={() => onApprove(request.id)}
									disabled={isLoading}
									className="gap-2"
								>
									{isLoading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Check className="mr-1 h-4 w-4" />
									)}
									Approve
								</Button>
								<Button
									size="sm"
									variant="outline"
									onClick={() => onDecline(request.id)}
									disabled={isLoading}
								>
									Decline
								</Button>
							</div>
						)}
						{isActive && (
							<div className="mt-3">
								<Button
									size="sm"
									onClick={() => onConfirmHandoff(request.id)}
									disabled={isLoading}
									className="gap-2"
								>
									{isLoading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Check className="mr-1 h-4 w-4" />
									)}
									Confirm Item Handed Off
								</Button>
							</div>
						)}
						{isLenderConfirmed && (
							<p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
								Waiting for {request.requester.name || 'borrower'} to confirm receipt
							</p>
						)}
						{isBorrowerConfirmed && (
							<p className="mt-2 text-xs text-green-600 dark:text-green-400">
								{request.requester.name || 'Borrower'} has confirmed receiving the item
							</p>
						)}
						{isReturnPending && (
							<div className="mt-3">
								<Button
									size="sm"
									onClick={() => onConfirmReturn(request.id)}
									disabled={isLoading}
									className="gap-2"
								>
									{isLoading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<CheckCheck className="mr-1 h-4 w-4" />
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
