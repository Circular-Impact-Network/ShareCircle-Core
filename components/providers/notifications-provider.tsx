'use client';

import { createContext, useContext, useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { getBrowserPushPermission, isPushSupported, urlBase64ToUint8Array } from '@/lib/push-client';
import { notificationsApi } from '@/lib/redux/api/notificationsApi';
import { borrowApi } from '@/lib/redux/api/borrowApi';
import { messagesApi } from '@/lib/redux/api/messagesApi';
import { useAppDispatch } from '@/lib/redux/hooks';

const PUSH_DEBUG_STORAGE_KEY = 'sharecircle_sw_last_push_at';

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

			const registration = await navigator.serviceWorker.ready;
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
			const pushStatus = await fetchPushStatus();
			if (!pushStatus.configured || !pushStatus.publicKey) {
				throw new Error('Push notifications are not configured on the server yet.');
			}

			const permission =
				Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
			setPushPermission(permission);

			if (permission !== 'granted') {
				throw new Error('Notification permission was not granted.');
			}

			const registration = await navigator.serviceWorker.ready;
			let subscription = await registration.pushManager.getSubscription();

			if (!subscription) {
				subscription = await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(pushStatus.publicKey),
				});
			}

			const response = await fetch('/api/push/subscriptions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(subscription.toJSON()),
			});

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
			const registration = await navigator.serviceWorker.ready;
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

		// Subscribe to user's notification channel
		const notificationChannel = supabase.channel(`notifications:${userId}`);
		notificationChannelRef.current = notificationChannel;

		notificationChannel
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
			.subscribe();

		// NOTE: Message channel (user:${userId}:messages) is handled by useUserMessages hook
		// in ChatContainer to avoid duplicate subscriptions. Unread count is updated above
		// via the NEW_MESSAGE notification type.

		return () => {
			notificationChannel.unsubscribe();
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
