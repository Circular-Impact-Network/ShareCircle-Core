'use client';

import { useEffect } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useDispatch } from 'react-redux';
import { createBrowserSupabaseClient, ensureRealtimeAuth, reportSubscription } from '@/lib/supabaseBrowser';
import { PRIVATE_CHANNEL } from '@/lib/realtime-channels';
import { itemsApi } from '@/lib/redux/api/itemsApi';

/**
 * Subscribe to per-circle item-change broadcasts so that when an item is added,
 * edited, deleted, or removed from a circle by anyone, every other viewer's list
 * updates immediately (not just the actor). The server broadcasts on
 * `circle:{id}:items`: `item_added` (POST /api/items), `item_changed`
 * (PATCH /api/items/[id]), `item_removed` (DELETE routes).
 * On any event we invalidate the relevant RTK Query caches, triggering a refetch.
 */
const ITEM_EVENTS = ['item_added', 'item_changed', 'item_removed'] as const;

export function useItemRealtime(circleIds: string[]) {
	const dispatch = useDispatch();
	// Stable key so we only re-subscribe when the actual set of circles changes.
	const key = [...circleIds].sort().join(',');

	useEffect(() => {
		const ids = key ? key.split(',') : [];
		if (ids.length === 0) return;
		const supabase = createBrowserSupabaseClient();
		if (!supabase) return;

		// Private channels need the socket authorised first, so the fan-out moves into the promise.
		let channels: RealtimeChannel[] = [];
		let cancelled = false;

		void ensureRealtimeAuth(supabase)
			.then(() => {
				if (cancelled) return;

				channels = ids.map(circleId => {
					const channel = supabase.channel(`circle:${circleId}:items`, PRIVATE_CHANNEL);
					for (const event of ITEM_EVENTS) {
						channel.on('broadcast', { event }, () => {
							dispatch(itemsApi.util.invalidateTags(['Items', { type: 'CircleItems', id: circleId }]));
						});
					}
					channel.subscribe(reportSubscription(`circle:${circleId}:items`));
					return channel;
				});
			})
			.catch(error => {
				console.error('Realtime auth failed; live item updates are disabled:', error);
			});

		return () => {
			cancelled = true;
			channels.forEach(channel => supabase.removeChannel(channel));
		};
	}, [key, dispatch]);
}
