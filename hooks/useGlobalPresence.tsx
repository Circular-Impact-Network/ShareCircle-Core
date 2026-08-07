'use client';

import { useEffect, useRef, useState, createContext, useContext, ReactNode, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient, ensureRealtimeAuth, reportSubscription } from '@/lib/supabaseBrowser';
import { PRIVATE_CHANNEL } from '@/lib/realtime-channels';

type GlobalPresenceContextType = {
	onlineUserIds: string[];
	isConnected: boolean;
};

const GlobalPresenceContext = createContext<GlobalPresenceContextType>({
	onlineUserIds: [],
	isConnected: false,
});

type GlobalPresenceProviderProps = {
	/** Optional explicit user id. When omitted, the current session's user id is used —
	 * lets the provider be mounted app-wide (in the authenticated layout) without prop drilling. */
	userId?: string | null;
	children: ReactNode;
};

export function GlobalPresenceProvider({ userId: userIdProp, children }: GlobalPresenceProviderProps) {
	const { data: session } = useSession();
	const userId = userIdProp !== undefined ? userIdProp : (session?.user?.id ?? null);
	const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const channelRef = useRef<RealtimeChannel | null>(null);

	const userKey = userId ? `user:${userId}` : null;

	useEffect(() => {
		if (!userId || !userKey) return;

		const supabase = createBrowserSupabaseClient();
		if (!supabase) return;

		// Shared online-status channel. Private like the rest, so an anonymous socket can no longer
		// enumerate who is online; the policy admits any authenticated user to this one topic.
		let channel: RealtimeChannel | null = null;
		let cancelled = false;

		void ensureRealtimeAuth(supabase)
			.then(() => {
				if (cancelled) return;

				const presenceChannel = supabase.channel('presence:messages', {
					config: {
						...PRIVATE_CHANNEL.config,
						presence: {
							key: userKey,
						},
					},
				});
				channel = presenceChannel;
				channelRef.current = presenceChannel;

				presenceChannel
					.on('presence', { event: 'sync' }, () => {
						const state = presenceChannel.presenceState<{ userId: string }>();
						const online = Object.values(state).flatMap(entries => entries.map(entry => entry.userId));
						setOnlineUserIds([...new Set(online)]);
					})
					.subscribe(async (status, error) => {
						reportSubscription('presence:messages')(status, error);
						if (status === 'SUBSCRIBED') {
							setIsConnected(true);
							await presenceChannel.track({ userId });
						} else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
							setIsConnected(false);
						}
					});
			})
			.catch(error => {
				console.error('Realtime auth failed; presence is disabled:', error);
			});

		return () => {
			cancelled = true;
			if (channel) supabase.removeChannel(channel);
			setIsConnected(false);
		};
	}, [userId, userKey]);

	const value = useMemo(() => ({ onlineUserIds, isConnected }), [onlineUserIds, isConnected]);

	return <GlobalPresenceContext.Provider value={value}>{children}</GlobalPresenceContext.Provider>;
}

export function useGlobalPresence() {
	return useContext(GlobalPresenceContext);
}
