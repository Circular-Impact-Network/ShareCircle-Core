import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FullTransaction } from '@/lib/redux/api/borrowApi';

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

// The context moved out of `@/app/providers` so that reading a preference no longer drags the
// Redux store and session provider in behind it.
vi.mock('@/lib/preferences-context', () => ({
	usePreferences: () => ({
		theme: 'light',
		toggleTheme: vi.fn(),
		fontSize: 'md',
		setFontSize: vi.fn(),
		weightUnit: 'kg',
		setWeightUnit: vi.fn(),
		currency: 'USD',
		setCurrency: vi.fn(),
		fxRates: { USD: 1, EUR: 0.92, GBP: 0.79, INR: 83.5, CAD: 1.36, AUD: 1.52 },
	}),
}));

// The InfiniteScrollSentinel uses IntersectionObserver; render it as an explicit button so a
// test can trigger "load more" deterministically.
vi.mock('@/components/ui/infinite-scroll-sentinel', () => ({
	InfiniteScrollSentinel: ({ hasMore, onLoadMore }: { hasMore: boolean; onLoadMore: () => void }) =>
		hasMore ? (
			<button type="button" data-testid="load-more" onClick={onLoadMore}>
				load more
			</button>
		) : null,
}));

const borrowerTransactions: FullTransaction[] = [];
const ownerTransactions: FullTransaction[] = [];

function makeTransaction(id: string, role: 'borrower' | 'owner'): FullTransaction {
	return {
		id,
		borrowRequestId: `req-${id}`,
		status: 'ACTIVE',
		dueAt: '2099-01-01T00:00:00.000Z',
		startAt: '2026-01-01T00:00:00.000Z',
		item: { id: `item-${id}`, name: `Item ${id}`, imageUrl: '' },
		borrower: { id: 'borrower-1', name: 'Bea', image: null },
		owner: { id: 'owner-1', name: 'Omar', image: null },
		borrowRequest: null,
		impact: null,
		_role: role,
	} as unknown as FullTransaction;
}

vi.mock('@/lib/redux/api/borrowApi', () => ({
	useGetBorrowRequestsQuery: () => ({ data: [], isLoading: false }),
	useGetQueueEntriesQuery: () => ({ data: [], isLoading: false }),
	useGetTransactionsQuery: ({ role }: { role: 'borrower' | 'owner' }) => ({
		data: role === 'borrower' ? borrowerTransactions : ownerTransactions,
		isLoading: false,
	}),
	useGetItemRequestsQuery: () => ({ data: [], isLoading: false }),
	useMarkAsReturnedMutation: () => [vi.fn()],
	useConfirmReturnMutation: () => [vi.fn()],
	useConfirmHandoffMutation: () => [vi.fn()],
	useConfirmReceiptMutation: () => [vi.fn()],
	useUpdateItemRequestMutation: () => [vi.fn()],
}));

async function renderPage(borrowed: number, lent: number) {
	borrowerTransactions.length = 0;
	ownerTransactions.length = 0;
	for (let i = 0; i < borrowed; i++) {
		borrowerTransactions.push(makeTransaction(`b${i}`, 'borrower'));
	}
	for (let i = 0; i < lent; i++) {
		ownerTransactions.push(makeTransaction(`l${i}`, 'owner'));
	}

	const { MyActivityPage } = await import('@/components/pages/my-activity-page');
	return render(<MyActivityPage />);
}

describe('MyActivityPage — active tab', () => {
	it('renders lent items even when borrowed items fill an entire page', async () => {
		// THE REGRESSION: one shared 8-item pagination window over
		// [...activeBorrowed, ...activeLent] meant 9 borrowed items consumed the whole window,
		// so the "Items I've Lent Out (2)" heading rendered with zero cards beneath it and
		// lenders could not see their lent items' status at all.
		await renderPage(9, 2);

		expect(screen.getByText(/Items I've Lent Out \(2\)/)).toBeInTheDocument();

		const roleBadges = screen.getAllByTestId('transaction-role');
		const lentCount = roleBadges.filter(b => b.textContent === 'Lent').length;
		expect(lentCount).toBe(2);
	});

	it('paginates each group independently', async () => {
		await renderPage(12, 11);

		// 8 per group, not 8 across both.
		const firstPage = screen.getAllByTestId('transaction-role');
		expect(firstPage.filter(b => b.textContent === 'Borrowed')).toHaveLength(8);
		expect(firstPage.filter(b => b.textContent === 'Lent')).toHaveLength(8);

		await userEvent.click(screen.getByTestId('load-more'));

		const secondPage = screen.getAllByTestId('transaction-role');
		expect(secondPage.filter(b => b.textContent === 'Borrowed')).toHaveLength(12);
		expect(secondPage.filter(b => b.textContent === 'Lent')).toHaveLength(11);
	});

	it('labels every card Borrowed or Lent', async () => {
		// The status badge only ever says "Borrow Approved" / "Item Handed Off" etc., so
		// without this the role was conveyed by the group heading alone.
		await renderPage(1, 1);

		const badges = screen.getAllByTestId('transaction-role').map(b => b.textContent);
		expect(badges).toContain('Borrowed');
		expect(badges).toContain('Lent');
	});
});

describe('MyActivityPage — raise a concern', () => {
	it('shows a disabled Raise a concern button with a Coming soon pill on every active card', async () => {
		await renderPage(1, 1);

		const buttons = screen.getAllByTestId('raise-concern-btn');
		expect(buttons).toHaveLength(2);

		for (const button of buttons) {
			expect(button).toBeDisabled();
			expect(within(button).getByText('Coming soon')).toBeInTheDocument();
		}
	});

	it('cannot be activated', async () => {
		await renderPage(1, 0);

		const button = screen.getByTestId('raise-concern-btn');
		// Purely a signpost — disabled:pointer-events-none means a click never lands.
		await userEvent.click(button, { pointerEventsCheck: 0 }).catch(() => undefined);
		expect(button).toBeDisabled();
	});
});
