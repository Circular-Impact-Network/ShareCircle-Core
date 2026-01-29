import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createBrowserSupabaseClient } from '@/lib/supabaseClient';
import type { ItemRequestStatus } from '@prisma/client';

export type RealtimeItemRequest = {
	id: string;
	title: string;
	description: string | null;
	status: ItemRequestStatus;
	desiredFrom: string | null;
	desiredTo: string | null;
	createdAt: string;
	requester: {
		id: string;
		name: string | null;
		image: string | null;
	};
	circle: {
		id: string;
		name: string;
	};
};

type RealtimeCircleRequestsOptions = {
	circleId: string | null;
	onItemRequest: (request: RealtimeItemRequest) => void;
	onItemRequestUpdate?: (request: Partial<RealtimeItemRequest> & { id: string }) => void;
};

export function useRealtimeCircleRequests({
	circleId,
	onItemRequest,
	onItemRequestUpdate,
}: RealtimeCircleRequestsOptions) {
	const channelRef = useRef<RealtimeChannel | null>(null);

	useEffect(() => {
		if (!circleId) return;

		const supabase = createBrowserSupabaseClient();
		if (!supabase) return;

		const channel = supabase.channel(`circle-requests:${circleId}`);
		channelRef.current = channel;

		channel
			.on('broadcast', { event: 'new_item_request' }, payload => {
				const request = payload.payload as RealtimeItemRequest;
				onItemRequest(request);
			})
			.on('broadcast', { event: 'item_request_update' }, payload => {
				const update = payload.payload as Partial<RealtimeItemRequest> & { id: string };
				onItemRequestUpdate?.(update);
			})
			.subscribe();

		return () => {
			channel.unsubscribe();
		};
	}, [circleId, onItemRequest, onItemRequestUpdate]);
}
