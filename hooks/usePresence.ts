import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabaseClient';
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
		const channel = supabase.channel(`typing:${conversationId}`);
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
				}, 2500);
			})
			.subscribe();

		return () => {
			channel.unsubscribe();
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
