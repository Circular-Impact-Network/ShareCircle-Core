import { describe, expect, it } from 'vitest';
import { isBorrowOverdue, getAnyBorrowStatusPresentation } from '@/lib/borrow-ui';

// Regression coverage for the UI-only overdue feature (no backend job): a borrow
// is overdue when its due date has passed AND the item is still in the borrower's
// hands. RETURN_PENDING / COMPLETED / CANCELLED are explicitly NOT overdue.
describe('isBorrowOverdue', () => {
	const past = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const future = new Date(Date.now() + 24 * 60 * 60 * 1000);

	it('returns false when there is no due date', () => {
		expect(isBorrowOverdue(null, 'ACTIVE')).toBe(false);
		expect(isBorrowOverdue(undefined, 'ACTIVE')).toBe(false);
	});

	it.each(['ACTIVE', 'LENDER_CONFIRMED', 'BORROWER_CONFIRMED'])(
		'returns true when past due in eligible status %s',
		status => {
			expect(isBorrowOverdue(past, status)).toBe(true);
		},
	);

	it('returns false when the due date is still in the future', () => {
		expect(isBorrowOverdue(future, 'ACTIVE')).toBe(false);
		expect(isBorrowOverdue(future, 'LENDER_CONFIRMED')).toBe(false);
	});

	it.each(['RETURN_PENDING', 'COMPLETED', 'CANCELLED'])(
		'returns false for settled/returning status %s even when past due',
		status => {
			expect(isBorrowOverdue(past, status)).toBe(false);
		},
	);

	it('accepts ISO date strings as well as Date objects', () => {
		expect(isBorrowOverdue(past.toISOString(), 'ACTIVE')).toBe(true);
		expect(isBorrowOverdue(future.toISOString(), 'ACTIVE')).toBe(false);
	});
});

describe('getAnyBorrowStatusPresentation', () => {
	it('resolves a status across the request / transaction / queue enums', () => {
		expect(getAnyBorrowStatusPresentation('PENDING').label).toBe('Pending Approval');
		expect(getAnyBorrowStatusPresentation('LENDER_CONFIRMED').label).toBe('Item Handed Off');
		expect(getAnyBorrowStatusPresentation('WAITING').label).toBe('In Queue');
	});

	it('falls back to an outline badge for unknown statuses', () => {
		const presentation = getAnyBorrowStatusPresentation('SOMETHING_NEW');
		expect(presentation).toEqual({ label: 'SOMETHING_NEW', tone: 'outline' });
	});
});
