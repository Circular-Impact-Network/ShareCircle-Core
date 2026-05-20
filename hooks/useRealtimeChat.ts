import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabaseBrowser';
import type { ChatMessage, MessageReceipt } from '@/components/chat/types';

type RealtimeChatOptions = {
	conversationId: string | null;
	currentUserId: string | null;
	onMessage: (message: ChatMessage) => void;
	onReceipts: (receipts: MessageReceipt[]) => void;
};

export function useRealtimeChat({ conversationId, currentUserId, onMessage, onReceipts }: RealtimeChatOptions) {
	const channelRef = useRef<RealtimeChannel | null>(null);

	// Use refs to store callbacks to avoid re-subscription when callbacks change
	const onMessageRef = useRef(onMessage);
	const onReceiptsRef = useRef(onReceipts);
	const currentUserIdRef = useRef(currentUserId);

	// Update refs when values change
	useEffect(() => {
		onMessageRef.current = onMessage;
	}, [onMessage]);

	useEffect(() => {
		onReceiptsRef.current = onReceipts;
	}, [onReceipts]);

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
				const { receipts } = payload.payload as { receipts: MessageReceipt[] };
				onReceiptsRef.current(receipts);
			})
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [conversationId]); // Only re-subscribe when conversationId changes
}
