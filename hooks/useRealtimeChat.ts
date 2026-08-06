import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient, ensureRealtimeAuth } from '@/lib/supabaseBrowser';
import { PRIVATE_CHANNEL } from '@/lib/realtime-channels';
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
		// A private channel refuses the join until the socket carries a JWT, so subscription waits
		// on the shared auth promise. `cancelled` guards an unmount mid-flight.
		let channel: RealtimeChannel | null = null;
		let cancelled = false;

		void ensureRealtimeAuth(supabase)
			.then(() => {
				if (cancelled) return;

				channel = supabase.channel(`messages:${conversationId}`, PRIVATE_CHANNEL);
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
			})
			.catch(error => {
				console.error('Realtime auth failed; live chat updates are disabled:', error);
			});

		return () => {
			cancelled = true;
			if (channel) supabase.removeChannel(channel);
		};
	}, [conversationId]); // Only re-subscribe when conversationId changes
}
