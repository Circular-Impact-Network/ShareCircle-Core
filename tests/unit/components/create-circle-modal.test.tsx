import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateCircleModal } from '@/components/modals/create-circle-modal';

describe('CreateCircleModal', () => {
	it('enforces circle name max length via input attribute', async () => {
		render(<CreateCircleModal open onOpenChange={() => undefined} />);

		// The input should have maxLength attribute to prevent typing more than 100 chars
		const nameInput = screen.getByPlaceholderText(/Beach House Friends/i);
		expect(nameInput).toHaveAttribute('maxlength', '100');
	});

	it('renders create circle form', async () => {
		render(<CreateCircleModal open onOpenChange={() => undefined} />);

		// Use heading role to avoid matching button with same text
		expect(screen.getByRole('heading', { name: 'Create Circle' })).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/Beach House Friends/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Create Circle' })).toBeInTheDocument();
	});

	it('shows character count', async () => {
		const user = userEvent.setup();
		render(<CreateCircleModal open onOpenChange={() => undefined} />);

		const nameInput = screen.getByPlaceholderText(/Beach House Friends/i);
		await user.type(nameInput, 'Test Circle');

		expect(screen.getByText(/characters/)).toBeInTheDocument();
	});
});
