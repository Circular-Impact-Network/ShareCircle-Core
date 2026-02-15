import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { CreateCircleModal } from '@/components/modals/create-circle-modal';
import { store } from '@/lib/redux';

function renderWithStore(ui: React.ReactElement) {
	return render(<Provider store={store}>{ui}</Provider>);
}

describe('CreateCircleModal', () => {
	it('enforces circle name max length via input attribute', async () => {
		renderWithStore(<CreateCircleModal open onOpenChange={() => undefined} />);

		// The input should have maxLength attribute to prevent typing more than 100 chars
		const nameInput = screen.getByPlaceholderText(/Beach House Friends/i);
		expect(nameInput).toHaveAttribute('maxlength', '100');
	});

	it('renders create circle form', async () => {
		renderWithStore(<CreateCircleModal open onOpenChange={() => undefined} />);

		// Use heading role to avoid matching button with same text
		expect(screen.getByRole('heading', { name: 'Create Circle' })).toBeInTheDocument();
		expect(screen.getByPlaceholderText(/Beach House Friends/i)).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Create Circle' })).toBeInTheDocument();
	});

	it('shows character count', async () => {
		const user = userEvent.setup();
		renderWithStore(<CreateCircleModal open onOpenChange={() => undefined} />);

		const nameInput = screen.getByPlaceholderText(/Beach House Friends/i);
		await user.type(nameInput, 'Test Circle');

		expect(screen.getByText(/characters/)).toBeInTheDocument();
	});
});
