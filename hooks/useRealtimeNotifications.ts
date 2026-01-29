import { useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabaseClient';
import type { NotificationType, NotificationStatus } from '@prisma/client';

export type RealtimeNotification = {
	id: string;
	type: NotificationType;
	entityId: string | null;
	title: string;
	body: string;
	metadata: Record<string, unknown> | null;
	status: NotificationStatus;
	createdAt: string;
};

type RealtimeNotificationsOptions = {
	userId: string | null;
	onNotification: (notification: RealtimeNotification) => void;
};

export function useRealtimeNotifications({ userId, onNotification }: RealtimeNotificationsOptions) {
	const channelRef = useRef<RealtimeChannel | null>(null);

	useEffect(() => {
		if (!userId) return;

		const supabase = createBrowserSupabaseClient();
		if (!supabase) return;

		const channel = supabase.channel(`notifications:${userId}`);
		channelRef.current = channel;

		channel
			.on('broadcast', { event: 'new_notification' }, payload => {
				const notification = payload.payload as RealtimeNotification;
				onNotification(notification);
			})
			.subscribe();

		return () => {
			channel.unsubscribe();
		};
	}, [userId, onNotification]);

	// Function to broadcast a notification (for testing or local updates)
	const broadcastNotification = useCallback(
		async (notification: Omit<RealtimeNotification, 'status' | 'createdAt'>) => {
			if (!channelRef.current) return;

			await channelRef.current.send({
				type: 'broadcast',
				event: 'new_notification',
				payload: {
					...notification,
					status: 'UNREAD',
					createdAt: new Date().toISOString(),
				},
			});
		},
		[]
	);

	return { broadcastNotification };
}
