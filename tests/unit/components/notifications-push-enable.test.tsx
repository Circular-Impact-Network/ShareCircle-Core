/**
 * Enabling push on a device.
 *
 * These assert the two things that made the toggle stick permanently on an installed PWA:
 * the permission prompt must be requested before anything is awaited (Safari only prompts while
 * the tap still counts as user activation), and no step may hang the toggle forever.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const toastMock = vi.fn();

/** A real VAPID public key — `urlBase64ToUint8Array` calls `atob`, which rejects a placeholder. */
const VAPID_PUBLIC_KEY = 'BPPoDctfUEv4etYena_jco5nN5C3AsnvYFGatnt3wStkybbCGgbbBkvZPPYcSfZVyrWDwcQhDtPQWBzIOcSfRJI';

vi.mock('next-auth/react', () => ({
	useSession: () => ({ data: { user: { id: 'user-1' } }, status: 'authenticated' }),
}));

vi.mock('@/hooks/useToast', () => ({
	useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/lib/redux/hooks', () => ({
	useAppDispatch: () => vi.fn(),
}));

vi.mock('@/lib/redux/api/notificationsApi', () => ({
	notificationsApi: { util: { invalidateTags: vi.fn() } },
}));
vi.mock('@/lib/redux/api/borrowApi', () => ({
	borrowApi: { util: { invalidateTags: vi.fn() } },
}));
vi.mock('@/lib/redux/api/messagesApi', () => ({
	messagesApi: { util: { invalidateTags: vi.fn() } },
}));

vi.mock('@/lib/supabaseBrowser', () => ({
	createBrowserSupabaseClient: () => {
		// `.on()` is chained several times before `.subscribe()`, so it has to return itself.
		const channel: Record<string, unknown> = {
			on: () => channel,
			subscribe: () => channel,
		};
		return { channel: () => channel, removeChannel: () => undefined };
	},
	ensureRealtimeAuth: vi.fn().mockResolvedValue(undefined),
	reportSubscription: () => vi.fn(),
}));

vi.mock('@/lib/realtime-channels', () => ({
	PRIVATE_CHANNEL: { config: { private: true } },
}));

import { NotificationsProvider, useNotificationsContext } from '@/components/providers/notifications-provider';

/** Records the order in which the browser and network steps are reached. */
let callOrder: string[] = [];

function EnableProbe() {
	const notifications = useNotificationsContext();
	return (
		<button type="button" onClick={() => void notifications?.enablePushNotifications()}>
			enable
		</button>
	);
}

function renderProbe() {
	return render(
		<NotificationsProvider>
			<EnableProbe />
		</NotificationsProvider>,
	);
}

function stubServiceWorker(subscribe: () => Promise<unknown>) {
	Object.defineProperty(navigator, 'serviceWorker', {
		configurable: true,
		value: {
			ready: Promise.resolve({
				pushManager: {
					getSubscription: async () => null,
					subscribe,
				},
			}),
			addEventListener: () => undefined,
			removeEventListener: () => undefined,
		},
	});
}

const validSubscription = {
	endpoint: 'https://push.example.com/abc',
	toJSON: () => ({
		endpoint: 'https://push.example.com/abc',
		keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
	}),
};

describe('enablePushNotifications', () => {
	beforeEach(() => {
		callOrder = [];
		toastMock.mockClear();
		vi.stubEnv('NODE_ENV', 'production');

		// `isPushSupported()` requires all three to be present, as they are in an installed PWA.
		Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} });
		Object.defineProperty(window, 'Notification', {
			configurable: true,
			value: Object.assign(class {}, {
				permission: 'default' as NotificationPermission,
				requestPermission: async () => {
					callOrder.push('requestPermission');
					return 'granted' as NotificationPermission;
				},
			}),
		});

		stubServiceWorker(async () => {
			callOrder.push('subscribe');
			return validSubscription;
		});

		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				callOrder.push(`fetch:${init?.method ?? 'GET'} ${url}`);
				if (url.includes('/api/push/subscriptions') && (init?.method ?? 'GET') === 'GET') {
					return {
						ok: true,
						json: async () => ({ configured: true, publicKey: VAPID_PUBLIC_KEY, subscriptions: 0 }),
					} as Response;
				}
				return { ok: true, json: async () => ({}) } as Response;
			}),
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it('requests permission before any network call, so Safari still has user activation', async () => {
		renderProbe();
		// The provider fetches push status once on mount; only the ordering inside the click matters.
		await waitFor(() => expect(callOrder.some(entry => entry.startsWith('fetch:GET'))).toBe(true));
		callOrder = [];

		await userEvent.click(screen.getByRole('button', { name: 'enable' }));

		await waitFor(() => expect(callOrder).toContain('subscribe'));

		const permissionAt = callOrder.indexOf('requestPermission');
		const firstFetchAt = callOrder.findIndex(entry => entry.startsWith('fetch:'));

		expect(permissionAt).toBeGreaterThanOrEqual(0);
		expect(firstFetchAt).toBeGreaterThanOrEqual(0);
		expect(permissionAt).toBeLessThan(firstFetchAt);
	});

	it('saves the subscription and reports success', async () => {
		renderProbe();
		await userEvent.click(screen.getByRole('button', { name: 'enable' }));

		await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Push enabled' })));
		expect(callOrder).toContain('fetch:POST /api/push/subscriptions');
	});

	it('surfaces an error instead of hanging when a platform step never settles', async () => {
		vi.useFakeTimers();
		// A promise that never settles is exactly what WebKit returns when activation has expired.
		stubServiceWorker(() => new Promise(() => {}));

		try {
			renderProbe();
			// `fireEvent` rather than `userEvent`, which schedules its own timers and would deadlock
			// against the fake clock this test needs in order to reach the 30s ceiling.
			fireEvent.click(screen.getByRole('button', { name: 'enable' }));

			await vi.advanceTimersByTimeAsync(31_000);

			expect(toastMock).toHaveBeenCalledWith(
				expect.objectContaining({ title: 'Could not enable push', variant: 'destructive' }),
			);
		} finally {
			vi.useRealTimers();
		}
	});

	it('tells the user how to recover when notifications are blocked at the OS level', async () => {
		Object.defineProperty(window, 'Notification', {
			configurable: true,
			value: Object.assign(class {}, {
				permission: 'denied' as NotificationPermission,
				requestPermission: async () => 'denied' as NotificationPermission,
			}),
		});

		renderProbe();
		await userEvent.click(screen.getByRole('button', { name: 'enable' }));

		await waitFor(() =>
			expect(toastMock).toHaveBeenCalledWith(
				expect.objectContaining({
					title: 'Could not enable push',
					description: expect.stringContaining('device settings'),
				}),
			),
		);
	});
});
