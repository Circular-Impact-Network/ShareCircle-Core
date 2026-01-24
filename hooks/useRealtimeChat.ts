import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabaseClient';
import type { ChatMessage, MessageReceipt } from '@/components/chat/types';

type RealtimeChatOptions = {
	conversationId: string | null;
	currentUserId: string | null;
	onMessage: (message: ChatMessage) => void;
	onReceipt: (receipt: MessageReceipt) => void;
};

export function useRealtimeChat({ conversationId, currentUserId, onMessage, onReceipt }: RealtimeChatOptions) {
	const channelRef = useRef<RealtimeChannel | null>(null);

	useEffect(() => {
		if (!conversationId) return;

		const supabase = createBrowserSupabaseClient();
		if (!supabase) return;
		const channel = supabase.channel(`messages:${conversationId}`);
		channelRef.current = channel;

		channel
			.on('broadcast', { event: 'new_message' }, payload => {
				const message = payload.payload as ChatMessage;
				// Skip messages from current user - they're handled optimistically
				if (currentUserId && message.senderId === currentUserId) {
					return;
				}
				onMessage(message);
			})
			.on('broadcast', { event: 'receipt_update' }, payload => {
				const receipt = payload.payload as MessageReceipt;
				onReceipt(receipt);
			})
			.subscribe();

		return () => {
			channel.unsubscribe();
		};
	}, [conversationId, currentUserId, onMessage, onReceipt]);
}
