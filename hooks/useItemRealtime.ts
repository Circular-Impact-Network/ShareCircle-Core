'use client';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { createBrowserSupabaseClient } from '@/lib/supabaseBrowser';
import { itemsApi } from '@/lib/redux/api/itemsApi';

/**
 * Subscribe to per-circle item-change broadcasts so that when an item is deleted
 * or removed from a circle by anyone, every other viewer's list updates immediately
 * (not just the actor). The server broadcasts `item_removed` on `circle:{id}:items`
 * (see app/api/items/[id] DELETE and app/api/circles/[id]/items/[itemId] DELETE).
 * On any event we invalidate the relevant RTK Query caches, triggering a refetch.
 */
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
			channel
				.on('broadcast', { event: 'item_removed' }, () => {
					dispatch(itemsApi.util.invalidateTags(['Items', { type: 'CircleItems', id: circleId }]));
				})
				.subscribe();
			return channel;
		});

		return () => {
			channels.forEach(channel => supabase.removeChannel(channel));
		};
	}, [key, dispatch]);
}
