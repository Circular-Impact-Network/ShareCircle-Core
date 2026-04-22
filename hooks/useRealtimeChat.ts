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

	// Use refs to store callbacks to avoid re-subscription when callbacks change
	const onMessageRef = useRef(onMessage);
	const onReceiptRef = useRef(onReceipt);
	const currentUserIdRef = useRef(currentUserId);

	// Update refs when values change
	useEffect(() => {
		onMessageRef.current = onMessage;
	}, [onMessage]);

	useEffect(() => {
		onReceiptRef.current = onReceipt;
	}, [onReceipt]);

	useEffect(() => {
		currentUserIdRef.current = currentUserId;
	}, [currentUserId]);

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
				if (currentUserIdRef.current && message.senderId === currentUserIdRef.current) {
					return;
				}
				onMessageRef.current(message);
			})
			.on('broadcast', { event: 'receipt_update' }, payload => {
				const receipt = payload.payload as MessageReceipt;
				onReceiptRef.current(receipt);
			})
			.subscribe();

		return () => {
			channel.unsubscribe();
		};
	}, [conversationId]); // Only re-subscribe when conversationId changes
}
