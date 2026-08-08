'use client';

import { createContext, useContext, useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient, ensureRealtimeAuth, reportSubscription } from '@/lib/supabaseBrowser';
import { PRIVATE_CHANNEL } from '@/lib/realtime-channels';
import { useToast } from '@/hooks/useToast';
import { getBrowserPushPermission, isPushSupported, urlBase64ToUint8Array } from '@/lib/push-client';
import { notificationsApi } from '@/lib/redux/api/notificationsApi';
import { borrowApi } from '@/lib/redux/api/borrowApi';
import { messagesApi } from '@/lib/redux/api/messagesApi';
import { useAppDispatch } from '@/lib/redux/hooks';

const PUSH_DEBUG_STORAGE_KEY = 'sharecircle_sw_last_push_at';

/**
 * Every step of the push handshake is a platform promise that can hang rather than reject:
 * `serviceWorker.ready` never settles if no worker activates, and WebKit silently drops
 * `requestPermission()` when transient user activation has expired. A hang leaves `pushLoading`
 * true forever, which disables the toggle permanently — the user sees a dead switch and no error.
 * Racing a timer turns every one of those into a message that names the step that stalled.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, step: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;

	return Promise.race([
		promise,
		new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error(`${step} timed out. Please try again.`)), ms);
		}),
	]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * Resolve a service worker registration that actually has an active worker.
 *
 * `navigator.serviceWorker.ready` cannot be used here. It never settles when no worker reaches
 * `activated` — which is exactly what a failed `install` produces — so a broken worker is
 * indistinguishable from a slow one, and the only symptom is a hang. Registering explicitly and
 * watching the state transition turns "install failed" into a stated error instead.
 */
async function resolveActiveRegistration(): Promise<ServiceWorkerRegistration> {
	const existing = await navigator.serviceWorker.getRegistration();
	if (existing?.active) {
		return existing;
	}

	const registration = existing ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
	if (registration.active) {
		return registration;
	}

	const pending = registration.installing ?? registration.waiting;
	if (!pending) {
		throw new Error('The service worker did not start. Reload the app and try again.');
	}

	await new Promise<void>((resolve, reject) => {
		const onStateChange = () => {
			if (pending.state === 'activated') {
				pending.removeEventListener('statechange', onStateChange);
				resolve();
			} else if (pending.state === 'redundant') {
				pending.removeEventListener('statechange', onStateChange);
				// A rejected `install` lands here. Most often one precached URL could not be fetched.
				reject(new Error('The service worker failed to install. Reload the app and try again.'));
			}
		};
		pending.addEventListener('statechange', onStateChange);
	});

	return registration;
}

interface NotificationsContextType {
	pushSupported: boolean;
	pushConfigured: boolean;
	pushEnabled: boolean;
	pushPermission: NotificationPermission | 'unsupported';
	pushLoading: boolean;
	swLastPushReceivedAt: string | null;
	refreshSwPushReceivedAt: () => void;
	enablePushNotifications: () => Promise<void>;
	disablePushNotifications: () => Promise<void>;
	refreshPushState: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | null>(null);

export function useNotificationsContext() {
	return useContext(NotificationsContext);
}

interface NotificationsProviderProps {
	children: ReactNode;
}

export function NotificationsProvider({ children }: NotificationsProviderProps) {
	const { data: session } = useSession();
	const { toast } = useToast();
	const dispatch = useAppDispatch();
	const notificationChannelRef = useRef<RealtimeChannel | null>(null);
	const messageChannelRef = useRef<RealtimeChannel | null>(null);
	/** Avoid duplicate upserts; reset when user logs out or endpoint changes. */
	const lastSyncedPushEndpointRef = useRef<string | null>(null);
	const userId = session?.user?.id;
	const [pushSupported, setPushSupported] = useState(false);
	const [pushConfigured, setPushConfigured] = useState(false);
	const [pushEnabled, setPushEnabled] = useState(false);
	const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
	const [pushLoading, setPushLoading] = useState(false);
	const [swLastPushReceivedAt, setSwLastPushReceivedAt] = useState<string | null>(null);

	const readSwPushDebugFromStorage = useCallback(() => {
		if (typeof window === 'undefined') {
			return null;
		}
		return window.localStorage.getItem(PUSH_DEBUG_STORAGE_KEY);
	}, []);

	const refreshSwPushReceivedAt = useCallback(() => {
		setSwLastPushReceivedAt(readSwPushDebugFromStorage());
	}, [readSwPushDebugFromStorage]);

	useEffect(() => {
		lastSyncedPushEndpointRef.current = null;
	}, [userId]);

	useEffect(() => {
		if (!userId || process.env.NODE_ENV !== 'production') {
			setSwLastPushReceivedAt(null);
			return;
		}
		setSwLastPushReceivedAt(readSwPushDebugFromStorage());
	}, [userId, readSwPushDebugFromStorage]);

	useEffect(() => {
		if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
			return;
		}

		const onMessage = (event: MessageEvent) => {
			if (event.data?.type === 'SC_PUSH_DEBUG' && typeof event.data.receivedAt === 'string') {
				try {
					window.localStorage.setItem(PUSH_DEBUG_STORAGE_KEY, event.data.receivedAt);
					setSwLastPushReceivedAt(event.data.receivedAt);
				} catch {
					setSwLastPushReceivedAt(event.data.receivedAt);
				}
			}
		};

		navigator.serviceWorker.addEventListener('message', onMessage);
		return () => navigator.serviceWorker.removeEventListener('message', onMessage);
	}, []);

	// Invalidate notification queries to refresh data
	const invalidateNotificationQueries = useCallback(() => {
		dispatch(notificationsApi.util.invalidateTags(['Notifications']));
		dispatch(borrowApi.util.invalidateTags(['BorrowRequests', 'Transactions', 'BorrowQueue', 'ItemRequests']));
	}, [dispatch]);

	// Invalidate message queries to refresh unread count
	const invalidateMessageQueries = useCallback(() => {
		dispatch(messagesApi.util.invalidateTags(['UnreadCount']));
	}, [dispatch]);

	const fetchPushStatus = useCallback(async () => {
		const response = await fetch('/api/push/subscriptions', {
			credentials: 'include',
		});

		if (!response.ok) {
			throw new Error('Failed to load push settings');
		}

		return (await response.json()) as {
			configured: boolean;
			publicKey: string | null;
			subscriptions: number;
			endpointHosts?: string[];
		};
	}, []);

	const refreshPushState = useCallback(async () => {
		if (!userId || process.env.NODE_ENV !== 'production') {
			lastSyncedPushEndpointRef.current = null;
			setPushSupported(false);
			setPushConfigured(false);
			setPushEnabled(false);
			setPushPermission('unsupported');
			setSwLastPushReceivedAt(null);
			return;
		}

		const supported = isPushSupported();
		setPushSupported(supported);
		setPushPermission(getBrowserPushPermission());

		if (!supported) {
			setPushConfigured(false);
			setPushEnabled(false);
			return;
		}

		try {
			const pushStatus = await fetchPushStatus();
			setPushConfigured(Boolean(pushStatus.configured && pushStatus.publicKey));

			if (!pushStatus.configured || !pushStatus.publicKey) {
				setPushEnabled(false);
				return;
			}

			const registration = await withTimeout(
				resolveActiveRegistration(),
				15_000,
				'Waiting for the service worker',
			);
			const subscription = await registration.pushManager.getSubscription();
			setPushEnabled(Boolean(subscription));

			// Keep the server row aligned with *this* browser/PWA registration. Otherwise the DB can
			// hold another device's endpoint (e.g. desktop) while this phone still shows "push on".
			if (
				subscription &&
				Notification.permission === 'granted' &&
				subscription.endpoint !== lastSyncedPushEndpointRef.current
			) {
				const syncRes = await fetch('/api/push/subscriptions', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify(subscription.toJSON()),
				});
				if (syncRes.ok) {
					lastSyncedPushEndpointRef.current = subscription.endpoint;
				}
			}
		} catch (error) {
			console.error('Failed to refresh push state:', error);
			setPushConfigured(false);
			setPushEnabled(false);
		}
	}, [fetchPushStatus, userId]);

	const enablePushNotifications = useCallback(async () => {
		if (!userId || process.env.NODE_ENV !== 'production') {
			toast({
				title: 'Push unavailable',
				description: 'Push notifications are only available in the production app.',
				variant: 'destructive',
			});
			return;
		}

		if (!isPushSupported()) {
			toast({
				title: 'Push unavailable',
				description: 'Your browser does not support web push notifications.',
				variant: 'destructive',
			});
			return;
		}

		setPushLoading(true);

		try {
			// Permission is requested BEFORE any await. Safari only shows the prompt while the tap
			// that triggered this call still counts as transient user activation, and awaiting even a
			// fast fetch first spends it — after which WebKit neither prompts nor settles the promise.
			// That is what left the toggle stuck: `finally` never ran, so `pushLoading` stayed true and
			// the switch disabled itself permanently with no error anywhere.
			let permission = Notification.permission;
			if (permission !== 'granted') {
				permission = await withTimeout(Notification.requestPermission(), 60_000, 'The permission prompt');
			}
			setPushPermission(permission);

			if (permission !== 'granted') {
				throw new Error(
					permission === 'denied'
						? 'Notifications are blocked for this app. Allow them in your device settings, then try again.'
						: 'Notification permission was not granted.',
				);
			}

			const pushStatus = await withTimeout(fetchPushStatus(), 15_000, 'Loading push settings');
			if (!pushStatus.configured || !pushStatus.publicKey) {
				throw new Error('Push notifications are not configured on the server yet.');
			}

			const registration = await withTimeout(
				resolveActiveRegistration(),
				15_000,
				'Waiting for the service worker',
			);
			let subscription = await registration.pushManager.getSubscription();

			if (!subscription) {
				subscription = await withTimeout(
					registration.pushManager.subscribe({
						userVisibleOnly: true,
						applicationServerKey: urlBase64ToUint8Array(pushStatus.publicKey),
					}),
					30_000,
					'Registering this device for push',
				);
			}

			const response = await withTimeout(
				fetch('/api/push/subscriptions', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify(subscription.toJSON()),
				}),
				15_000,
				'Saving your subscription',
			);

			if (!response.ok) {
				throw new Error('Failed to save your push subscription.');
			}

			lastSyncedPushEndpointRef.current = subscription.endpoint;
			setPushConfigured(true);
			setPushEnabled(true);
			toast({
				title: 'Push enabled',
				description: 'ShareCircle can now alert you when new activity happens in the background.',
			});
		} catch (error) {
			console.error('Failed to enable push notifications:', error);
			toast({
				title: 'Could not enable push',
				description: error instanceof Error ? error.message : 'Please try again from a supported browser.',
				variant: 'destructive',
			});
		} finally {
			setPushLoading(false);
		}
	}, [fetchPushStatus, toast, userId]);

	const disablePushNotifications = useCallback(async () => {
		if (!isPushSupported()) {
			setPushEnabled(false);
			return;
		}

		setPushLoading(true);

		try {
			const registration = await withTimeout(
				resolveActiveRegistration(),
				15_000,
				'Waiting for the service worker',
			);
			const subscription = await registration.pushManager.getSubscription();

			if (subscription) {
				await fetch('/api/push/subscriptions', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ endpoint: subscription.endpoint }),
				});
				await subscription.unsubscribe();
			}

			lastSyncedPushEndpointRef.current = null;
			setPushEnabled(false);
			toast({
				title: 'Push disabled',
				description: 'Background notifications have been turned off for this device.',
			});
		} catch (error) {
			console.error('Failed to disable push notifications:', error);
			toast({
				title: 'Could not disable push',
				description: 'Please try again in a moment.',
				variant: 'destructive',
			});
		} finally {
			setPushLoading(false);
		}
	}, [toast]);

	useEffect(() => {
		if (!userId) return;

		const supabase = createBrowserSupabaseClient();
		if (!supabase) return;

		// Subscribe to user's notification channel. Private, so the socket must be authorised
		// first — otherwise anyone with the anon key could read another user's notifications by
		// guessing their id.
		let notificationChannel: RealtimeChannel | null = null;
		let cancelled = false;

		void ensureRealtimeAuth(supabase)
			.then(() => {
				if (cancelled) return;

				const channel = supabase.channel(`notifications:${userId}`, PRIVATE_CHANNEL);
				notificationChannel = channel;
				notificationChannelRef.current = channel;

				channel
					.on('broadcast', { event: 'new_notification' }, payload => {
						const notification = payload.payload as {
							id: string;
							type: string;
							title: string;
							body: string;
							metadata?: Record<string, unknown>;
						};

						// Show toast for new notification
						toast({
							title: notification.title,
							description: notification.body || 'There is new activity waiting for you.',
						});

						// Invalidate queries to refresh data
						invalidateNotificationQueries();

						// Also refresh message count for NEW_MESSAGE notifications
						if (notification.type === 'NEW_MESSAGE') {
							invalidateMessageQueries();
						}
					})
					.on('broadcast', { event: 'request_status_changed' }, () => {
						// Refresh borrow requests data
						invalidateNotificationQueries();
					})
					.on('broadcast', { event: 'transaction_updated' }, () => {
						// Refresh transactions data
						invalidateNotificationQueries();
					})
					.subscribe(reportSubscription(`notifications:${userId}`));
			})
			.catch(error => {
				console.error('Realtime auth failed; live notifications are disabled:', error);
			});

		// NOTE: Message channel (user:${userId}:messages) is handled by useUserMessages hook
		// in ChatContainer to avoid duplicate subscriptions. Unread count is updated above
		// via the NEW_MESSAGE notification type.

		return () => {
			cancelled = true;
			// `removeChannel` both unsubscribes and frees the supabase client's internal
			// reference; calling only `unsubscribe()` leaks the channel for the page lifetime.
			if (notificationChannel) supabase.removeChannel(notificationChannel);
			notificationChannelRef.current = null;
			messageChannelRef.current = null;
		};
	}, [userId, toast, invalidateNotificationQueries, invalidateMessageQueries]);

	useEffect(() => {
		if (!userId) {
			setPushSupported(false);
			setPushConfigured(false);
			setPushEnabled(false);
			setPushPermission('unsupported');
			setSwLastPushReceivedAt(null);
			return;
		}

		refreshPushState().catch(error => {
			console.error('Failed to initialize push state:', error);
		});

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				refreshPushState().catch(console.error);
			}
		};

		window.addEventListener('focus', handleVisibilityChange);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			window.removeEventListener('focus', handleVisibilityChange);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	}, [refreshPushState, userId]);

	return (
		<NotificationsContext.Provider
			value={{
				pushSupported,
				pushConfigured,
				pushEnabled,
				pushPermission,
				pushLoading,
				swLastPushReceivedAt,
				refreshSwPushReceivedAt,
				enablePushNotifications,
				disablePushNotifications,
				refreshPushState,
			}}
		>
			{children}
		</NotificationsContext.Provider>
	);
}
