import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient, ensureRealtimeAuth } from '@/lib/supabaseBrowser';
import { PRIVATE_CHANNEL } from '@/lib/realtime-channels';
import type { ChatUser } from '@/components/chat/types';

type TypingState = {
	typingUserIds: string[];
	sendTyping: () => void;
};

/**
 * Hook for conversation-specific typing indicators.
 * Online status is handled separately by useGlobalPresence at the Messages tab level.
 */
export function useTypingIndicator(conversationId: string | null, currentUser: ChatUser | null): TypingState {
	const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
	const channelRef = useRef<RealtimeChannel | null>(null);
	const typingTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

	useEffect(() => {
		if (!conversationId || !currentUser) return;

		const supabase = createBrowserSupabaseClient();
		if (!supabase) return;
		// Typing is a client-sent broadcast, so this channel needs both the SELECT and INSERT
		// policies on realtime.messages — the socket must be authorised before either works.
		let channel: RealtimeChannel | null = null;
		let cancelled = false;

		void ensureRealtimeAuth(supabase)
			.then(() => {
				if (cancelled) return;

				channel = supabase.channel(`typing:${conversationId}`, PRIVATE_CHANNEL);
				channelRef.current = channel;

				channel
					.on('broadcast', { event: 'typing' }, payload => {
						const senderId = payload.payload?.userId as string | undefined;
						if (!senderId || senderId === currentUser.id) return;
						setTypingUserIds(prev => (prev.includes(senderId) ? prev : [...prev, senderId]));
						if (typingTimeouts.current[senderId]) {
							clearTimeout(typingTimeouts.current[senderId]);
						}
						typingTimeouts.current[senderId] = setTimeout(() => {
							setTypingUserIds(prev => prev.filter(id => id !== senderId));
							delete typingTimeouts.current[senderId];
						}, 2500);
					})
					.subscribe();
			})
			.catch(error => {
				console.error('Realtime auth failed; typing indicators are disabled:', error);
			});

		return () => {
			cancelled = true;
			if (channel) supabase.removeChannel(channel);
			Object.values(typingTimeouts.current).forEach(timeout => clearTimeout(timeout));
			typingTimeouts.current = {};
		};
	}, [conversationId, currentUser]);

	const sendTyping = useMemo(
		() => () => {
			if (!channelRef.current || !currentUser) return;
			channelRef.current.send({
				type: 'broadcast',
				event: 'typing',
				payload: { userId: currentUser.id },
			});
		},
		[currentUser],
	);

	return { typingUserIds, sendTyping };
}
