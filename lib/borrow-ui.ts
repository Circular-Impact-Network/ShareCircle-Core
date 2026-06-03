// Canonical display rules for borrow / queue / transaction / item-request status.
//
// Keeps label, badge tone, and (where applicable) test-data attributes in one
// place so cards and pages don't re-derive these case-by-case. Pure presentation
// — no DOM. Callers wrap the result in their own <Badge /> element.

import type {
	BorrowRequestStatus,
	BorrowQueueStatus,
	BorrowTransactionStatus,
	ItemRequestStatus,
} from '@prisma/client';

export type BadgeTone =
	| 'default'
	| 'secondary'
	| 'destructive'
	| 'outline'
	// Custom tones used by my-activity / cards — render with className overrides
	// in the calling badge component.
	| 'info' // blue
	| 'warn' // amber
	| 'success'; // green

export type StatusPresentation = {
	label: string;
	tone: BadgeTone;
};

const BORROW_REQUEST: Record<BorrowRequestStatus, StatusPresentation> = {
	PENDING: { label: 'Pending Approval', tone: 'secondary' },
	APPROVED: { label: 'Approved', tone: 'default' },
	DECLINED: { label: 'Declined', tone: 'destructive' },
	CANCELLED: { label: 'Cancelled', tone: 'outline' },
};

const BORROW_QUEUE: Record<BorrowQueueStatus, StatusPresentation> = {
	WAITING: { label: 'In Queue', tone: 'secondary' },
	READY: { label: 'Ready to Request', tone: 'success' },
	SKIPPED: { label: 'Skipped', tone: 'outline' },
	CANCELLED: { label: 'Cancelled', tone: 'outline' },
};

const BORROW_TRANSACTION: Record<BorrowTransactionStatus, StatusPresentation> = {
	ACTIVE: { label: 'Borrow Approved', tone: 'info' },
	LENDER_CONFIRMED: { label: 'Item Handed Off', tone: 'warn' },
	BORROWER_CONFIRMED: { label: 'Item Received', tone: 'success' },
	RETURN_PENDING: { label: 'Return Pending', tone: 'secondary' },
	COMPLETED: { label: 'Returned', tone: 'outline' },
	CANCELLED: { label: 'Cancelled', tone: 'outline' },
};

const ITEM_REQUEST: Record<ItemRequestStatus, StatusPresentation> = {
	OPEN: { label: 'Open', tone: 'default' },
	FULFILLED: { label: 'Fulfilled', tone: 'secondary' },
	CANCELLED: { label: 'Closed', tone: 'outline' },
};

export function getBorrowRequestPresentation(status: BorrowRequestStatus | string): StatusPresentation {
	return BORROW_REQUEST[status as BorrowRequestStatus] ?? { label: String(status), tone: 'outline' };
}

export function getBorrowQueuePresentation(status: BorrowQueueStatus | string): StatusPresentation {
	return BORROW_QUEUE[status as BorrowQueueStatus] ?? { label: String(status), tone: 'outline' };
}

export function getBorrowTransactionPresentation(status: BorrowTransactionStatus | string): StatusPresentation {
	return BORROW_TRANSACTION[status as BorrowTransactionStatus] ?? { label: String(status), tone: 'outline' };
}

export function getItemRequestPresentation(status: ItemRequestStatus | string): StatusPresentation {
	return ITEM_REQUEST[status as ItemRequestStatus] ?? { label: String(status), tone: 'outline' };
}

// Transaction states where the item is still in the borrower's hands and a due
// date is meaningful. RETURN_PENDING / COMPLETED / CANCELLED are excluded —
// the item is on its way back or already settled.
const OVERDUE_ELIGIBLE_STATUSES = ['ACTIVE', 'LENDER_CONFIRMED', 'BORROWER_CONFIRMED'];

// UI-only overdue check (no backend job): a borrow is overdue when its due date
// has passed and the item is still out. Computed at render time.
export function isBorrowOverdue(dueAt: string | Date | null | undefined, status: string): boolean {
	if (!dueAt || !OVERDUE_ELIGIBLE_STATUSES.includes(status)) return false;
	return new Date(dueAt).getTime() < Date.now();
}

// Unified helper for "any borrow-flow status string we have lying around" —
// matches the prior ad-hoc getStatusBadge() in my-activity-page.tsx which
// dispatched across all three borrow enums by string value.
export function getAnyBorrowStatusPresentation(status: string): StatusPresentation {
	return (
		BORROW_REQUEST[status as BorrowRequestStatus] ??
		BORROW_TRANSACTION[status as BorrowTransactionStatus] ??
		BORROW_QUEUE[status as BorrowQueueStatus] ?? { label: status, tone: 'outline' }
	);
}

// Tailwind class lookups for the custom tones (used by callers that prefer a
// single component to handle all tones; opt-in).
export const TONE_CLASSES: Record<BadgeTone, string> = {
	default: '',
	secondary: '',
	destructive: '',
	outline: '',
	info: 'bg-blue-500 hover:bg-blue-500',
	warn: 'bg-amber-500 hover:bg-amber-500',
	success: 'bg-green-500 hover:bg-green-500',
};

// Convenience: render-ready props for shadcn <Badge>. Custom tones map to
// variant=default + className overrides; standard variants pass through.
export function toBadgeProps(presentation: StatusPresentation): {
	variant: 'default' | 'secondary' | 'destructive' | 'outline';
	className?: string;
} {
	switch (presentation.tone) {
		case 'info':
		case 'warn':
		case 'success':
			return { variant: 'default', className: TONE_CLASSES[presentation.tone] };
		case 'default':
		case 'secondary':
		case 'destructive':
		case 'outline':
			return { variant: presentation.tone };
	}
}
