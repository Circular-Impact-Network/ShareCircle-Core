import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppTour } from '@/components/tour/app-tour';

/**
 * The tour belongs to the account, never to the browser.
 *
 * It used to consult a single `sharecircle_tour_completed` key in localStorage before anything
 * else, and return early when it was set. So finishing the tour once on a laptop denied it to every
 * account that browser saw afterwards — sign out, sign up, and the new user's onboarding was
 * skipped without the server ever being asked. Worse, `/api/tour` reports `completed: true` when its
 * own read fails, and the client wrote that answer to localStorage, so a single transient database
 * error suppressed the tour on that browser permanently. In production four of the last eight
 * signups sat with a null completion flag, having never been shown it.
 *
 * These assert the gate, not the spotlight: whether driver.js draws anything is its own business,
 * and happy-dom reports no layout boxes so no step can resolve an anchor here anyway.
 */

vi.mock('driver.js', () => ({
	driver: vi.fn(() => ({ drive: vi.fn(), destroy: vi.fn(), getActiveIndex: vi.fn() })),
}));
vi.mock('driver.js/dist/driver.css', () => ({}));

function mockTourApi(completed: boolean) {
	const fetchMock = vi.fn((url: string, init?: RequestInit) => {
		if (init?.method === 'POST') {
			return Promise.resolve({ ok: true, json: () => Promise.resolve({ completed: true }) } as Response);
		}
		return Promise.resolve({ ok: true, json: () => Promise.resolve({ completed }) } as Response);
	});
	vi.stubGlobal('fetch', fetchMock);
	return fetchMock;
}

const posts = (fetchMock: ReturnType<typeof mockTourApi>) =>
	fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST');

beforeEach(() => {
	window.localStorage.clear();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe('who the tour is offered to', () => {
	it('asks the account even when another account finished the tour in this browser', async () => {
		// Exactly the state the reported bug left behind: a previous account's completion flag.
		window.localStorage.setItem('sharecircle_tour_completed', '1');
		const fetchMock = mockTourApi(false);

		render(<AppTour onFinished={vi.fn()} />);

		await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/tour', expect.anything()));
	});

	it('never lets a stale browser key stand in for the account', async () => {
		window.localStorage.setItem('sharecircle_tour_completed', '1');
		const onFinished = vi.fn();
		mockTourApi(false);

		render(<AppTour onFinished={onFinished} />);

		// The account has not completed it, so the component must not report itself finished on the
		// strength of the browser key alone — that early return was the whole defect.
		await waitFor(() => expect(onFinished).not.toHaveBeenCalled(), { timeout: 400 });
	});

	it('does not run again for an account that has already finished it', async () => {
		const onFinished = vi.fn();
		const fetchMock = mockTourApi(true);

		render(<AppTour onFinished={onFinished} />);

		await waitFor(() => expect(onFinished).toHaveBeenCalled());
		expect(posts(fetchMock)).toHaveLength(0);
	});

	/**
	 * The flag is the account's one shot: nothing else ever sets it, and nothing clears it. Recording
	 * completion for a tour that drew nothing — because the navigation had not painted yet on a slow
	 * phone — spent that shot on an empty screen.
	 */
	it('does not record completion when no step could be shown', async () => {
		const onFinished = vi.fn();
		const fetchMock = mockTourApi(false);

		render(<AppTour onFinished={onFinished} />);

		// Long enough to outlast every retry, so this observes the final state rather than a gap
		// between two attempts.
		await waitFor(() => expect(onFinished).toHaveBeenCalled(), { timeout: 8000 });
		expect(posts(fetchMock), 'marked the account complete without showing anything').toHaveLength(0);
	}, 12000);

	/**
	 * 600ms is a guess about somebody else's phone. The component is mounted by the authenticated
	 * layout, which survives client-side navigation, so a single missed attempt is not retried by
	 * anything short of a full page reload — which a new user has no reason to perform.
	 */
	it('keeps waiting for the navigation to paint instead of giving up on the first look', async () => {
		const onFinished = vi.fn();
		mockTourApi(false);

		render(<AppTour onFinished={onFinished} />);

		// Well past the first attempt: a single-shot implementation has already surrendered by now.
		await new Promise(resolve => setTimeout(resolve, 1600));
		expect(onFinished, 'gave up after one attempt at finding the navigation').not.toHaveBeenCalled();
	}, 12000);
});
