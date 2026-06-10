import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CompleteProfilePage from '@/app/complete-profile/page';

vi.mock('next/navigation', () => ({
	useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
	useSearchParams: () => ({ get: () => null }),
}));

vi.mock('next-auth/react', () => ({
	useSession: () => ({ update: vi.fn() }),
	signOut: vi.fn(),
}));

vi.mock('next/link', () => ({
	default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

// First-time Google users land here via the middleware gate. They must accept the
// policies before they can finish onboarding and reach the app.
describe('Complete profile page', () => {
	it('disables Continue until the policies are accepted', async () => {
		const user = userEvent.setup();
		render(<CompleteProfilePage />);

		const continueButton = await screen.findByRole('button', { name: 'Continue' });
		expect(continueButton).toBeDisabled();

		await user.click(screen.getByRole('checkbox'));

		expect(continueButton).toBeEnabled();
	});

	it('links to the terms and privacy pages', async () => {
		render(<CompleteProfilePage />);

		expect(await screen.findByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms');
		expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
	});
});
