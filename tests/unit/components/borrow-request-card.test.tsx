import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BorrowRequestCard } from '@/components/cards/borrow-request-card';
import type { BorrowRequest } from '@/lib/redux/api/borrowApi';

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

// Minimal pending borrow request the lender would see in the notifications "Borrow Requests" tab.
const pendingRequest = {
	id: 'req-1',
	status: 'PENDING',
	message: 'Could I borrow this over the weekend?',
	desiredFrom: '2026-08-01T00:00:00.000Z',
	desiredTo: '2026-08-05T00:00:00.000Z',
	item: { id: 'item-1', name: 'Power Drill', imageUrl: '' },
	requester: { id: 'user-9', name: 'Bhavya', image: null },
	transaction: null,
} as unknown as BorrowRequest;

const baseProps = {
	onApprove: vi.fn(),
	onDecline: vi.fn(),
	onConfirmReturn: vi.fn(),
	onConfirmHandoff: vi.fn(),
	isLoading: false,
};

describe('BorrowRequestCard — chat with requester (E6)', () => {
	it('renders a Chat button when onChat is provided', () => {
		render(<BorrowRequestCard request={pendingRequest} {...baseProps} onChat={vi.fn()} />);
		expect(screen.getByTestId('chat-btn')).toBeInTheDocument();
	});

	it('does not render a Chat button when onChat is omitted', () => {
		render(<BorrowRequestCard request={pendingRequest} {...baseProps} />);
		expect(screen.queryByTestId('chat-btn')).not.toBeInTheDocument();
	});

	it('calls onChat with the requester id, item id and item name', async () => {
		const onChat = vi.fn();
		render(<BorrowRequestCard request={pendingRequest} {...baseProps} onChat={onChat} />);

		await userEvent.click(screen.getByTestId('chat-btn'));

		expect(onChat).toHaveBeenCalledWith('user-9', 'item-1', 'Power Drill');
	});
});
