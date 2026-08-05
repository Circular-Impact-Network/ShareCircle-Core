import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import Signup from '@/app/signup/page';

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn() }),
	useSearchParams: () => ({ get: () => null }),
}));

vi.mock('next-auth/react', () => ({
	signIn: vi.fn(),
}));

vi.mock('next/link', () => ({
	default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

describe('Signup page', () => {
	// Requirement (2026-08-05): "Sign up with google button should not be disabled. It is
	// depending on the thing that user will check the accepting terms and conditions thing,
	// but we are capturing and asking it later anyway... It causes confusion."
	//
	// The terms checkbox belongs to the email form, so it still gates Create Account. Google
	// users accept on /complete-profile, which the middleware always routes them through
	// because they have no date of birth.
	it('gates Create Account on the terms checkbox but never the Google button', async () => {
		const user = userEvent.setup();
		render(<Signup />);

		const createButton = screen.getByRole('button', { name: 'Create Account' });
		const googleButton = screen.getByTestId('google-signup-btn');

		expect(createButton).toBeDisabled();
		expect(googleButton).toBeEnabled();

		await user.click(screen.getByRole('checkbox'));

		expect(createButton).toBeEnabled();
		expect(googleButton).toBeEnabled();
	});

	it('tells the user where the Google terms consent happens', () => {
		render(<Signup />);
		// Without this, ungating the button silently drops the visible consent step.
		expect(
			screen.getByText(/confirm the Terms of Service and Privacy Policy on the next step/i),
		).toBeInTheDocument();
	});

	it('shows validation error for mismatched passwords', async () => {
		const user = userEvent.setup();
		render(<Signup />);

		// Accept the policies first so the Create Account button is enabled.
		await user.click(screen.getByRole('checkbox'));

		// Use placeholder text selectors as the labels don't have proper htmlFor
		await user.type(screen.getByPlaceholderText('John Doe'), 'Test User');
		await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
		const passwordInputs = screen.getAllByPlaceholderText('••••••••');
		await user.type(passwordInputs[0], 'Password123!');
		await user.type(passwordInputs[1], 'Password123');
		await user.click(screen.getByRole('button', { name: 'Create Account' }));

		expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
	});

	// Requirement (2026-08-05): "Password requirements while signup should come realtime and
	// not like when clicking submit. It's frustrating."
	describe('live password requirements', () => {
		it('shows nothing until the user starts typing', () => {
			render(<Signup />);
			expect(screen.queryByTestId('password-requirements')).not.toBeInTheDocument();
		});

		it('updates each rule as the user types, with no submit', async () => {
			const user = userEvent.setup();
			render(<Signup />);

			await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'abc');

			// Appeared without any button being clicked — that is the whole point.
			expect(screen.getByTestId('password-requirements')).toBeInTheDocument();
			expect(screen.getByTestId('password-rule-lowercase')).toHaveAttribute('data-met', 'true');
			expect(screen.getByTestId('password-rule-length')).toHaveAttribute('data-met', 'false');
			expect(screen.getByTestId('password-rule-uppercase')).toHaveAttribute('data-met', 'false');
			expect(screen.getByTestId('password-rule-number')).toHaveAttribute('data-met', 'false');
			expect(screen.getByTestId('password-rule-special')).toHaveAttribute('data-met', 'false');
		});

		it('marks every rule met for a password the API would accept', async () => {
			const user = userEvent.setup();
			render(<Signup />);

			await user.type(screen.getAllByPlaceholderText('••••••••')[0], 'Password123!');

			for (const rule of ['length', 'uppercase', 'lowercase', 'number', 'special']) {
				expect(screen.getByTestId(`password-rule-${rule}`)).toHaveAttribute('data-met', 'true');
			}
		});

		// Regression: the client used to check `password.length < 6` while the API required 8
		// characters plus four character classes, so this password passed the form and came
		// back rejected by the server.
		it('rejects a 6-character password the old client check would have accepted', async () => {
			const user = userEvent.setup();
			render(<Signup />);

			await user.click(screen.getByRole('checkbox'));
			await user.type(screen.getByPlaceholderText('John Doe'), 'Test User');
			await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
			const passwordInputs = screen.getAllByPlaceholderText('••••••••');
			await user.type(passwordInputs[0], 'abc123');
			await user.type(passwordInputs[1], 'abc123');
			await user.click(screen.getByRole('button', { name: 'Create Account' }));

			expect(screen.getByText(/at least 8 characters and contain at least one uppercase/i)).toBeInTheDocument();
		});

		it('flags a confirm-password mismatch while typing', async () => {
			const user = userEvent.setup();
			render(<Signup />);

			const passwordInputs = screen.getAllByPlaceholderText('••••••••');
			await user.type(passwordInputs[0], 'Password123!');
			await user.type(passwordInputs[1], 'Password123');

			expect(screen.getByTestId('confirm-mismatch')).toBeInTheDocument();

			await user.type(passwordInputs[1], '!');
			expect(screen.queryByTestId('confirm-mismatch')).not.toBeInTheDocument();
		});
	});
});
