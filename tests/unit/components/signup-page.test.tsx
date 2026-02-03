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
	it('shows validation error for mismatched passwords', async () => {
		const user = userEvent.setup();
		render(<Signup />);

		// Use placeholder text selectors as the labels don't have proper htmlFor
		await user.type(screen.getByPlaceholderText('John Doe'), 'Test User');
		await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
		const passwordInputs = screen.getAllByPlaceholderText('••••••••');
		await user.type(passwordInputs[0], 'Password123!');
		await user.type(passwordInputs[1], 'Password123');
		await user.click(screen.getByRole('button', { name: 'Create Account' }));

		expect(screen.getByText("Passwords don't match")).toBeInTheDocument();
	});
});
