import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabaseClient';
import type { ChatMessage } from '@/components/chat/types';

type UseUserMessagesOptions = {
	userId: string | null;
	onNewMessage: (message: ChatMessage) => void;
};

/**
 * Mark a message as delivered by calling the API.
 * This triggers a broadcast back to the sender showing the delivered tick.
 */
async function markAsDelivered(messageId: string) {
	try {
		await fetch('/api/messages/delivered', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messageId }),
		});
	} catch (error) {
		console.error('Failed to mark message as delivered:', error);
	}
}

/**
 * Hook that listens for new messages across ALL conversations for the current user.
 * This is used to update the chat list in real-time even when no specific chat is open.
 * Also marks messages as delivered when received.
 */
export function useUserMessages({ userId, onNewMessage }: UseUserMessagesOptions) {
	const channelRef = useRef<RealtimeChannel | null>(null);

	// Use ref to store callback to avoid re-subscription when callback changes
	const onNewMessageRef = useRef(onNewMessage);

	useEffect(() => {
		onNewMessageRef.current = onNewMessage;
	}, [onNewMessage]);

	useEffect(() => {
		if (!userId) return;

		const supabase = createBrowserSupabaseClient();
		if (!supabase) return;

		const channel = supabase.channel(`user:${userId}:messages`);
		channelRef.current = channel;

		channel
			.on('broadcast', { event: 'new_message' }, payload => {
				const message = payload.payload as ChatMessage;
				onNewMessageRef.current(message);
				// Mark the message as delivered (shows double grey tick to sender)
				markAsDelivered(message.id);
			})
			.subscribe();

		return () => {
			channel.unsubscribe();
		};
	}, [userId]); // Only re-subscribe when userId changes
}
