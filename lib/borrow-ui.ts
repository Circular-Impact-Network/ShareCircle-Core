// Canonical display rules for borrow / queue / transaction / item-request status.
//
// Keeps label, badge tone, and (where applicable) test-data attributes in one
// place so cards and pages don't re-derive these case-by-case. Pure presentation
// — no DOM. Callers wrap the result in their own <Badge /> element.

import type { BorrowRequestStatus, BorrowQueueStatus, BorrowTransactionStatus, ItemRequestStatus } from '@prisma/client';

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
