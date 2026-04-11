import { render } from '@testing-library/react';
import { vi } from 'vitest';
import { NotificationsProvider } from '@/components/providers/notifications-provider';

const toastSpy = vi.fn();
const dispatchSpy = vi.fn();

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

vi.mock('@/hooks/use-toast', () => ({
	useToast: () => ({ toast: toastSpy }),
}));

vi.mock('@/lib/redux/hooks', () => ({
	useAppDispatch: () => dispatchSpy,
}));

vi.mock('@/lib/supabaseClient', () => ({
	createBrowserSupabaseClient: () => ({
		channel: (name: string) => {
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
	}),
}));

describe('NotificationsProvider', () => {
	it('responds to new notification broadcasts', () => {
		render(
			<NotificationsProvider>
				<div>child</div>
			</NotificationsProvider>,
		);

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

	it('invalidates message queries for NEW_MESSAGE notifications', () => {
		render(
			<NotificationsProvider>
				<div>child</div>
			</NotificationsProvider>,
		);

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
