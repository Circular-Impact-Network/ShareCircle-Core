import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import Login from '@/app/login/page';

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
	useSearchParams: () => ({ get: () => null }),
}));

vi.mock('next-auth/react', () => ({
	signIn: vi.fn(),
}));

vi.mock('next/link', () => ({
	default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

describe('Login page', () => {
	it('shows validation errors for missing fields', async () => {
		const user = userEvent.setup();
		render(<Login />);

		await user.click(screen.getByRole('button', { name: 'Login' }));
		expect(screen.getByText('Please fill in all fields')).toBeInTheDocument();
	});

	// Note: Email validation test is covered by E2E tests since the tabbed
	// form interface has timing complexities in unit tests with happy-dom.
	// See tests/e2e/auth.spec.ts for comprehensive auth flow testing.
});
