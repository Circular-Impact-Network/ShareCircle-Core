import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('CreateCircleModal — duplicate names', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('surfaces the 409 when the user already has a circle with that name', async () => {
		// Circle names are unique per creator, enforced by both a pre-check and a functional
		// unique index. The user needs to see why the create failed, not a generic message.
		vi.spyOn(console, 'error').mockImplementation(() => {});
		// A real Response: fetchBaseQuery clones and inspects content-type, so a plain object
		// is parsed as an unknown error and the specific message is lost.
		vi.stubGlobal(
			'fetch',
			vi.fn(
				async () =>
					new Response(JSON.stringify({ error: 'You already have a circle with this name.' }), {
						status: 409,
						headers: { 'content-type': 'application/json' },
					}),
			),
		);

		const user = userEvent.setup();
		renderWithStore(<CreateCircleModal open onOpenChange={() => undefined} />);

		await user.type(screen.getByPlaceholderText(/Beach House Friends/i), 'Family');
		await user.click(screen.getByRole('button', { name: 'Create Circle' }));

		await waitFor(() => {
			expect(screen.getByText('You already have a circle with this name.')).toBeInTheDocument();
		});
	});
});
