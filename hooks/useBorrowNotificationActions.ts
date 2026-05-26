'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/useToast';
import {
	useUpdateBorrowRequestMutation,
	useConfirmReturnMutation,
	useConfirmHandoffMutation,
	useConfirmReceiptMutation,
} from '@/lib/redux/api/borrowApi';

type ErrorWithData = { data?: { error?: string } };

function extractErrorMessage(err: unknown, fallback: string): string {
	if (err && typeof err === 'object' && 'data' in err) {
		return (err as ErrorWithData).data?.error || fallback;
	}
	return fallback;
}

// Encapsulates the borrow-flow action handlers historically inlined in
// notifications-page (approve, decline, confirm handoff/receipt/return).
// Owns its processingId + completedActions state so the page doesn't have to.
export function useBorrowNotificationActions({ refetchRequests }: { refetchRequests: () => Promise<unknown> }) {
	const { toast } = useToast();
	const [updateBorrowRequest] = useUpdateBorrowRequestMutation();
	const [confirmReturn] = useConfirmReturnMutation();
	const [confirmHandoff] = useConfirmHandoffMutation();
	const [confirmReceipt] = useConfirmReceiptMutation();

	const [processingId, setProcessingId] = useState<string | null>(null);
	const [completedActions, setCompletedActions] = useState<Map<string, string>>(new Map());

	const handleApprove = async (id: string) => {
		setProcessingId(id);
		try {
			await updateBorrowRequest({ id, action: 'approve' }).unwrap();
			toast({ title: 'Request approved!' });
			await refetchRequests();
		} catch (err) {
			console.error('Approve request error:', err);
			toast({
				title: 'Failed to approve request',
				description: extractErrorMessage(err, 'Failed to approve request'),
				variant: 'destructive',
			});
		} finally {
			setProcessingId(null);
		}
	};

	const handleDecline = async (id: string) => {
		setProcessingId(id);
		try {
			await updateBorrowRequest({ id, action: 'decline' }).unwrap();
			toast({ title: 'Request declined' });
			await refetchRequests();
		} catch (err) {
			console.error('Decline request error:', err);
			toast({
				title: 'Failed to decline request',
				description: extractErrorMessage(err, 'Failed to decline request'),
				variant: 'destructive',
			});
		} finally {
			setProcessingId(null);
		}
	};

	const handleConfirmReturn = async (id: string) => {
		setProcessingId(id);
		try {
			await confirmReturn(id).unwrap();
			setCompletedActions(prev => new Map(prev).set(id, 'Return confirmed'));
			toast({ title: 'Return confirmed!' });
		} catch {
			toast({ title: 'Failed to confirm return', variant: 'destructive' });
		} finally {
			setProcessingId(null);
		}
	};

	const handleConfirmHandoff = async (id: string) => {
		setProcessingId(id);
		try {
			await confirmHandoff(id).unwrap();
			toast({ title: 'Handoff confirmed! Borrower has been notified.' });
		} catch {
			toast({ title: 'Failed to confirm handoff', variant: 'destructive' });
		} finally {
			setProcessingId(null);
		}
	};

	const handleConfirmReceipt = async (id: string) => {
		setProcessingId(id);
		try {
			await confirmReceipt(id).unwrap();
			setCompletedActions(prev => new Map(prev).set(id, 'Item marked as received'));
			toast({ title: 'Receipt confirmed!', description: 'Lender has been notified.' });
		} catch {
			toast({ title: 'Failed to confirm receipt', variant: 'destructive' });
		} finally {
			setProcessingId(null);
		}
	};

	return {
		processingId,
		completedActions,
		handleApprove,
		handleDecline,
		handleConfirmReturn,
		handleConfirmHandoff,
		handleConfirmReceipt,
	};
}
