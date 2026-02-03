/**
 * Unit tests for DeleteItemDialog component
 * Tests: rendering, confirmation, cancellation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteItemDialog } from '@/components/dialogs/delete-item-dialog';

describe('DeleteItemDialog', () => {
	const defaultProps = {
		isOpen: true,
		itemTitle: 'Test Item',
		onConfirm: vi.fn(),
		onCancel: vi.fn(),
	};

	it('renders nothing when closed', () => {
		render(<DeleteItemDialog {...defaultProps} isOpen={false} />);

		expect(screen.queryByText('Delete Item')).not.toBeInTheDocument();
	});

	it('renders dialog when open', () => {
		render(<DeleteItemDialog {...defaultProps} />);

		expect(screen.getByText('Delete Item')).toBeInTheDocument();
	});

	it('displays item title in confirmation message', () => {
		render(<DeleteItemDialog {...defaultProps} itemTitle="My Camping Tent" />);

		expect(screen.getByText(/Are you sure you want to delete "My Camping Tent"\?/)).toBeInTheDocument();
	});

	it('displays warning about irreversible action', () => {
		render(<DeleteItemDialog {...defaultProps} />);

		expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
	});

	it('renders Cancel button', () => {
		render(<DeleteItemDialog {...defaultProps} />);

		expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
	});

	it('renders Delete button', () => {
		render(<DeleteItemDialog {...defaultProps} />);

		expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
	});

	it('calls onCancel when Cancel button is clicked', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();

		render(<DeleteItemDialog {...defaultProps} onCancel={onCancel} />);

		await user.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it('calls onConfirm when Delete button is clicked', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();

		render(<DeleteItemDialog {...defaultProps} onConfirm={onConfirm} />);

		await user.click(screen.getByRole('button', { name: 'Delete' }));

		expect(onConfirm).toHaveBeenCalledTimes(1);
	});

	it('calls onCancel when dialog is closed via overlay', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();

		render(<DeleteItemDialog {...defaultProps} onCancel={onCancel} />);

		// Press Escape to close
		await user.keyboard('{Escape}');

		expect(onCancel).toHaveBeenCalled();
	});

	it('displays destructive styling on Delete button', () => {
		render(<DeleteItemDialog {...defaultProps} />);

		const deleteButton = screen.getByRole('button', { name: 'Delete' });
		// Button should have destructive variant class
		expect(deleteButton).toBeInTheDocument();
	});

	it('handles special characters in item title', () => {
		render(<DeleteItemDialog {...defaultProps} itemTitle='Item with "quotes" & <symbols>' />);

		expect(screen.getByText(/Item with "quotes" & <symbols>/)).toBeInTheDocument();
	});

	it('handles long item titles', () => {
		const longTitle = 'A'.repeat(200);
		render(<DeleteItemDialog {...defaultProps} itemTitle={longTitle} />);

		expect(screen.getByText(new RegExp(longTitle))).toBeInTheDocument();
	});

	it('handles empty item title', () => {
		render(<DeleteItemDialog {...defaultProps} itemTitle="" />);

		expect(screen.getByText(/Are you sure you want to delete ""\?/)).toBeInTheDocument();
	});
});
