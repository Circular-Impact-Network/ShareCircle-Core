'use client';

import { createContext, useContext, useCallback, useEffect, useRef, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { notificationsApi } from '@/lib/redux/api/notificationsApi';
import { borrowApi } from '@/lib/redux/api/borrowApi';
import { messagesApi } from '@/lib/redux/api/messagesApi';
import { useAppDispatch } from '@/lib/redux/hooks';

interface NotificationsContextType {
	// Context can be extended if needed
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
	const userId = session?.user?.id;

	// Invalidate notification queries to refresh data
	const invalidateNotificationQueries = useCallback(() => {
		dispatch(notificationsApi.util.invalidateTags(['Notifications']));
		dispatch(borrowApi.util.invalidateTags(['BorrowRequests', 'Transactions', 'BorrowQueue', 'ItemRequests']));
	}, [dispatch]);

	// Invalidate message queries to refresh unread count
	const invalidateMessageQueries = useCallback(() => {
		dispatch(messagesApi.util.invalidateTags(['UnreadCount']));
	}, [dispatch]);

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
					description: notification.body,
				});

				// Invalidate queries to refresh data
				invalidateNotificationQueries();
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

		// Subscribe to user's message channel for new messages
		const messageChannel = supabase.channel(`user:${userId}:messages`);
		messageChannelRef.current = messageChannel;

		messageChannel
			.on('broadcast', { event: 'new_message' }, payload => {
				const message = payload.payload as {
					id: string;
					senderId: string;
					body: string;
					sender?: { id: string; name: string | null; image: string | null };
				};

				// Only show toast if it's from someone else
				if (message.senderId !== userId) {
					toast({
						title: message.sender?.name || 'New message',
						description: message.body?.substring(0, 50) + (message.body?.length > 50 ? '...' : ''),
					});
				}

				// Invalidate message count query
				invalidateMessageQueries();
			})
			.on('broadcast', { event: 'messages_read' }, () => {
				// Invalidate message count query when messages are marked as read
				invalidateMessageQueries();
			})
			.subscribe();

		return () => {
			notificationChannel.unsubscribe();
			messageChannel.unsubscribe();
			notificationChannelRef.current = null;
			messageChannelRef.current = null;
		};
	}, [userId, toast, invalidateNotificationQueries, invalidateMessageQueries]);

	return (
		<NotificationsContext.Provider value={{}}>
			{children}
		</NotificationsContext.Provider>
	);
}
