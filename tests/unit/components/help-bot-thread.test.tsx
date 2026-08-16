import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HelpBot } from '@/components/help/help-bot';

/**
 * The assistant must not occupy the corner a conversation needs.
 *
 * The composer is pinned above the bottom navigation and its Send button sits at the same offset in
 * the same corner as the floating launcher — which is `fixed` and painted later, so it wins. The
 * result was that a message could not be sent at all: the launcher swallowed every tap meant for
 * Send. Losing the assistant on one screen is a far smaller cost than losing the ability to reply.
 *
 * Asserted per route rather than by measuring geometry, because jsdom has no layout and the overlap
 * depends on `env(safe-area-inset-bottom)`, which only a real device reports as non-zero.
 */

const pathname = vi.hoisted(() => ({ current: '/home' }));

vi.mock('next/navigation', () => ({
	usePathname: () => pathname.current,
}));

vi.mock('@/components/tour/app-tour', () => ({
	startTourManually: vi.fn(),
}));

function renderAt(route: string) {
	pathname.current = route;
	return render(<HelpBot />);
}

describe('help assistant placement by route', () => {
	it('offers the launcher on ordinary screens', () => {
		renderAt('/home');
		expect(screen.getByTestId('help-bot-launcher')).toBeTruthy();
	});

	it('stays out of a conversation thread, where Send owns that corner', () => {
		renderAt('/messages/clx123abc456');
		expect(screen.queryByTestId('help-bot-launcher')).toBeNull();
	});

	it('still offers the launcher on the thread list, which has no composer', () => {
		renderAt('/messages');
		expect(screen.getByTestId('help-bot-launcher')).toBeTruthy();
	});

	// A trailing slash is the same page; matching only the exact form would put the launcher back
	// over the Send button for a URL the router treats as identical.
	it('treats a trailing slash as the same thread', () => {
		renderAt('/messages/clx123abc456/');
		expect(screen.queryByTestId('help-bot-launcher')).toBeNull();
	});
});
