import { useEffect, useRef, useState, createContext, useContext, ReactNode, useMemo } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabaseClient';

type GlobalPresenceContextType = {
	onlineUserIds: string[];
	isConnected: boolean;
};

const GlobalPresenceContext = createContext<GlobalPresenceContextType>({
	onlineUserIds: [],
	isConnected: false,
});

type GlobalPresenceProviderProps = {
	userId: string | null;
	children: ReactNode;
};

export function GlobalPresenceProvider({ userId, children }: GlobalPresenceProviderProps) {
	const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
	const [isConnected, setIsConnected] = useState(false);
	const channelRef = useRef<RealtimeChannel | null>(null);

	const userKey = userId ? `user:${userId}` : null;

	useEffect(() => {
		if (!userId || !userKey) return;

		const supabase = createBrowserSupabaseClient();
		if (!supabase) return;

		const channel = supabase.channel('presence:messages', {
			config: {
				presence: {
					key: userKey,
				},
			},
		});
		channelRef.current = channel;

		channel
			.on('presence', { event: 'sync' }, () => {
				const state = channel.presenceState<{ userId: string }>();
				const online = Object.values(state).flatMap(entries => entries.map(entry => entry.userId));
				setOnlineUserIds([...new Set(online)]);
			})
			.subscribe(async status => {
				if (status === 'SUBSCRIBED') {
					setIsConnected(true);
					await channel.track({ userId });
				} else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
					setIsConnected(false);
				}
			});

		return () => {
			channel.unsubscribe();
			setIsConnected(false);
		};
	}, [userId, userKey]);

	const value = useMemo(() => ({ onlineUserIds, isConnected }), [onlineUserIds, isConnected]);

	return <GlobalPresenceContext.Provider value={value}>{children}</GlobalPresenceContext.Provider>;
}

export function useGlobalPresence() {
	return useContext(GlobalPresenceContext);
}
