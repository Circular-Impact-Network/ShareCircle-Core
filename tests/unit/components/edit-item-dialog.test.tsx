/**
 * Unit tests for EditItemDialog component
 * Tests: rendering, form inputs, save/cancel actions
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EditItemDialog } from '@/components/dialogs/edit-item-dialog';

describe('EditItemDialog', () => {
	const defaultProps = {
		isOpen: true,
		itemTitle: 'Test Item',
		itemCircle: 'Test Circle',
		onConfirm: vi.fn(),
		onCancel: vi.fn(),
	};

	it('renders nothing when closed', () => {
		render(<EditItemDialog {...defaultProps} isOpen={false} />);

		expect(screen.queryByText('Edit Item')).not.toBeInTheDocument();
	});

	it('renders dialog when open', () => {
		render(<EditItemDialog {...defaultProps} />);

		expect(screen.getByText('Edit Item')).toBeInTheDocument();
	});

	it('displays description text', () => {
		render(<EditItemDialog {...defaultProps} />);

		expect(screen.getByText('Update the details of your item below.')).toBeInTheDocument();
	});

	it('renders title input with current value', () => {
		render(<EditItemDialog {...defaultProps} itemTitle="My Item" />);

		const titleInput = screen.getByLabelText('Item Title');
		expect(titleInput).toHaveValue('My Item');
	});

	it('renders circle input with current value', () => {
		render(<EditItemDialog {...defaultProps} itemCircle="My Circle" />);

		const circleInput = screen.getByLabelText('Circle');
		expect(circleInput).toHaveValue('My Circle');
	});

	it('renders Cancel button', () => {
		render(<EditItemDialog {...defaultProps} />);

		expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
	});

	it('renders Save Changes button', () => {
		render(<EditItemDialog {...defaultProps} />);

		expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
	});

	it('allows editing title', async () => {
		const user = userEvent.setup();
		render(<EditItemDialog {...defaultProps} />);

		const titleInput = screen.getByLabelText('Item Title');
		await user.clear(titleInput);
		await user.type(titleInput, 'New Title');

		expect(titleInput).toHaveValue('New Title');
	});

	it('allows editing circle', async () => {
		const user = userEvent.setup();
		render(<EditItemDialog {...defaultProps} />);

		const circleInput = screen.getByLabelText('Circle');
		await user.clear(circleInput);
		await user.type(circleInput, 'New Circle');

		expect(circleInput).toHaveValue('New Circle');
	});

	it('calls onConfirm with updated values when Save is clicked', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();

		render(<EditItemDialog {...defaultProps} onConfirm={onConfirm} />);

		const titleInput = screen.getByLabelText('Item Title');
		const circleInput = screen.getByLabelText('Circle');

		await user.clear(titleInput);
		await user.type(titleInput, 'Updated Title');
		await user.clear(circleInput);
		await user.type(circleInput, 'Updated Circle');

		await user.click(screen.getByRole('button', { name: 'Save Changes' }));

		expect(onConfirm).toHaveBeenCalledWith('Updated Title', 'Updated Circle');
	});

	it('calls onCancel when Cancel button is clicked', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();

		render(<EditItemDialog {...defaultProps} onCancel={onCancel} />);

		await user.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it('resets form values when Cancel is clicked', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();

		render(<EditItemDialog {...defaultProps} itemTitle="Original" onCancel={onCancel} />);

		const titleInput = screen.getByLabelText('Item Title');
		await user.clear(titleInput);
		await user.type(titleInput, 'Changed');

		await user.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(onCancel).toHaveBeenCalled();
	});

	it('resets form values after Save is clicked', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();

		render(<EditItemDialog {...defaultProps} itemTitle="Original" onConfirm={onConfirm} />);

		const titleInput = screen.getByLabelText('Item Title');
		await user.clear(titleInput);
		await user.type(titleInput, 'Changed');

		await user.click(screen.getByRole('button', { name: 'Save Changes' }));

		expect(onConfirm).toHaveBeenCalledWith('Changed', 'Test Circle');
	});

	it('calls onCancel when dialog is closed via Escape', async () => {
		const user = userEvent.setup();
		const onCancel = vi.fn();

		render(<EditItemDialog {...defaultProps} onCancel={onCancel} />);

		await user.keyboard('{Escape}');

		expect(onCancel).toHaveBeenCalled();
	});

	it('has proper placeholder text for title input', () => {
		render(<EditItemDialog {...defaultProps} />);

		const titleInput = screen.getByPlaceholderText('Enter item title');
		expect(titleInput).toBeInTheDocument();
	});

	it('has proper placeholder text for circle input', () => {
		render(<EditItemDialog {...defaultProps} />);

		const circleInput = screen.getByPlaceholderText('Enter circle name');
		expect(circleInput).toBeInTheDocument();
	});

	it('handles empty initial values', () => {
		render(<EditItemDialog {...defaultProps} itemTitle="" itemCircle="" />);

		const titleInput = screen.getByLabelText('Item Title');
		const circleInput = screen.getByLabelText('Circle');

		expect(titleInput).toHaveValue('');
		expect(circleInput).toHaveValue('');
	});

	it('handles special characters in title and circle', async () => {
		const user = userEvent.setup();
		const onConfirm = vi.fn();

		render(
			<EditItemDialog
				{...defaultProps}
				itemTitle='Item "with" <special> chars & stuff'
				itemCircle="Circle's Name"
				onConfirm={onConfirm}
			/>,
		);

		await user.click(screen.getByRole('button', { name: 'Save Changes' }));

		expect(onConfirm).toHaveBeenCalledWith('Item "with" <special> chars & stuff', "Circle's Name");
	});
});
