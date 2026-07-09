'use client';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { createBrowserSupabaseClient } from '@/lib/supabaseBrowser';
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

		const channels = ids.map(circleId => {
			const channel = supabase.channel(`circle:${circleId}:items`);
			for (const event of ITEM_EVENTS) {
				channel.on('broadcast', { event }, () => {
					dispatch(itemsApi.util.invalidateTags(['Items', { type: 'CircleItems', id: circleId }]));
				});
			}
			channel.subscribe();
			return channel;
		});

		return () => {
			channels.forEach(channel => supabase.removeChannel(channel));
		};
	}, [key, dispatch]);
}
