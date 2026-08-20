import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HelpBot } from '@/components/help/help-bot';
import { MobileHeader } from '@/components/app/mobile-header';
import { Sidebar } from '@/components/app/sidebar';

/**
 * The assistant is reached from the navigation, not from a floating button.
 *
 * The floating launcher sat in the bottom-right corner at the same offset as the message composer's
 * Send button, and won because it was `fixed` and painted later — so a message could not be sent at
 * all on a phone. The first fix hid the launcher on `/messages/<id>`, which cured the thread and left
 * the assistant unreachable on the screen people were most likely to be stuck on. Moving the trigger
 * into the header and the sidebar removes the collision rather than dodging it.
 *
 * So the load-bearing assertions here are that nothing floats any more, and that both layouts can
 * still open the panel — losing the desktop trigger would be a silent regression, since the sidebar
 * and the header never appear at the same time.
 */

const pathname = vi.hoisted(() => ({ current: '/home' }));

vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('next-auth/react', () => ({ signOut: vi.fn() }));
vi.mock('@/lib/redux/hooks', () => ({ useAppSelector: () => undefined }));
vi.mock('@/lib/redux/api/notificationsApi', () => ({
	useGetUnreadNotificationCountQuery: () => ({ data: undefined }),
}));
vi.mock('@/lib/redux/api/messagesApi', () => ({ useGetUnreadMessageCountQuery: () => ({ data: undefined }) }));
vi.mock('@/components/modals/feedback-modal', () => ({ FeedbackModal: () => null }));
vi.mock('@/components/tour/app-tour', () => ({ startTourManually: vi.fn() }));

beforeEach(() => {
	pathname.current = '/home';
});

afterEach(() => {
	vi.clearAllMocks();
});

describe('the help assistant is reached from the navigation', () => {
	it('renders nothing at all while closed, so it cannot cover the composer', () => {
		const { container } = render(<HelpBot />);

		expect(container.firstChild, 'the panel renders something before it is opened').toBeNull();
		expect(screen.queryByTestId('help-bot-launcher'), 'the floating launcher is back').toBeNull();
	});

	it('offers the trigger in the mobile header, beside the guide and feedback', () => {
		render(<MobileHeader />);

		const trigger = screen.getByTestId('help-bot-trigger-mobile');
		expect(trigger.getAttribute('aria-label')).toBe('Open help assistant');
		// Grouped with the other two things a stuck user reaches for.
		expect(screen.getByLabelText('Help and guide')).toBeTruthy();
		expect(screen.getByLabelText('Share feedback')).toBeTruthy();
	});

	it('keeps the tour anchor on the trigger in both layouts', () => {
		const { unmount } = render(<MobileHeader />);
		expect(screen.getByTestId('help-bot-trigger-mobile').getAttribute('data-tour')).toBe('help-bot');
		unmount();

		render(<Sidebar />);
		expect(screen.getByTestId('help-bot-trigger-desktop').getAttribute('data-tour')).toBe('help-bot');
	});

	it('opens the panel from the mobile header', () => {
		render(
			<>
				<MobileHeader />
				<HelpBot />
			</>,
		);

		expect(screen.queryByTestId('help-bot-panel')).toBeNull();
		fireEvent.click(screen.getByTestId('help-bot-trigger-mobile'));

		expect(screen.getByTestId('help-bot-panel')).toBeTruthy();
	});

	it('opens the panel from the sidebar, so desktop did not lose the assistant', () => {
		render(
			<>
				<Sidebar />
				<HelpBot />
			</>,
		);

		fireEvent.click(screen.getByTestId('help-bot-trigger-desktop'));

		expect(screen.getByTestId('help-bot-panel')).toBeTruthy();
	});

	/**
	 * The thread is where the collision happened and where the first fix withdrew the assistant. This
	 * fails the moment anyone reintroduces a route check.
	 */
	it('is reachable inside a message thread', () => {
		pathname.current = '/messages/clx123abc456';

		render(
			<>
				<MobileHeader />
				<HelpBot />
			</>,
		);

		fireEvent.click(screen.getByTestId('help-bot-trigger-mobile'));

		expect(screen.getByTestId('help-bot-panel')).toBeTruthy();
	});
});
