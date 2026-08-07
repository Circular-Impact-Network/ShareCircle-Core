import { act, render } from '@testing-library/react';
import { vi } from 'vitest';
import { NotificationsProvider } from '@/components/providers/notifications-provider';

const toastSpy = vi.fn();
const dispatchSpy = vi.fn();

const channelConfigs: Record<string, unknown> = {};

/** The provider opens its channel a microtask after render, once auth resolves. */
async function flushRealtimeAuth() {
	await act(async () => {
		await Promise.resolve();
	});
}

const channels: Record<
	string,
	{
		handlers: Record<string, (payload: { payload: unknown }) => void>;
		subscribe: ReturnType<typeof vi.fn>;
		unsubscribe: ReturnType<typeof vi.fn>;
	}
> = {};

vi.mock('next-auth/react', () => ({
	useSession: () => ({
		data: { user: { id: 'user-1' } },
	}),
}));

vi.mock('@/hooks/useToast', () => ({
	useToast: () => ({ toast: toastSpy }),
}));

vi.mock('@/lib/redux/hooks', () => ({
	useAppDispatch: () => dispatchSpy,
}));

vi.mock('@/lib/supabaseBrowser', () => ({
	// The provider awaits this before opening its channel; without it no channel is ever created.
	ensureRealtimeAuth: () => Promise.resolve(),
	createBrowserSupabaseClient: () => ({
		channel: (name: string, config?: unknown) => {
			channelConfigs[name] = config;
			const handlers: Record<string, (payload: { payload: unknown }) => void> = {};
			const channel = {
				on: (_type: string, { event }: { event: string }, handler: (payload: { payload: unknown }) => void) => {
					handlers[event] = handler;
					return channel;
				},
				subscribe: vi.fn(),
				unsubscribe: vi.fn(),
			};
			channels[name] = { handlers, subscribe: channel.subscribe, unsubscribe: channel.unsubscribe };
			return channel;
		},
		removeChannel: vi.fn(),
	}),
}));

describe('NotificationsProvider', () => {
	it('subscribes to its notification channel as a private channel', async () => {
		render(
			<NotificationsProvider>
				<div>child</div>
			</NotificationsProvider>,
		);
		await flushRealtimeAuth();

		// Private is what makes the RLS policies on realtime.messages apply. A public channel here
		// would be readable by anyone holding the anon key who knows the user id.
		expect(channelConfigs['notifications:user-1']).toEqual({ config: { private: true } });
	});

	it('responds to new notification broadcasts', async () => {
		render(
			<NotificationsProvider>
				<div>child</div>
			</NotificationsProvider>,
		);
		await flushRealtimeAuth();

		const notificationChannel = channels['notifications:user-1'];
		notificationChannel.handlers.new_notification({
			payload: {
				id: 'notification-1',
				title: 'New Item Request',
				body: 'Someone requested an item.',
			},
		});

		expect(toastSpy).toHaveBeenCalled();
		expect(dispatchSpy).toHaveBeenCalled();
	});

	it('invalidates message queries for NEW_MESSAGE notifications', async () => {
		render(
			<NotificationsProvider>
				<div>child</div>
			</NotificationsProvider>,
		);
		await flushRealtimeAuth();

		const notificationChannel = channels['notifications:user-1'];
		notificationChannel.handlers.new_notification({
			payload: {
				id: 'notification-2',
				type: 'NEW_MESSAGE',
				title: 'New message from Sender',
				body: 'Hello!',
			},
		});

		expect(toastSpy).toHaveBeenCalled();
		// dispatch called for both notification invalidation and message count invalidation
		expect(dispatchSpy).toHaveBeenCalled();
	});
});
