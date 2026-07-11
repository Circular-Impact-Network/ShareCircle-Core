'use client';

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { createBrowserSupabaseClient } from '@/lib/supabaseBrowser';
import { circlesApi } from '@/lib/redux/api/circlesApi';

/**
 * Subscribe to a circle's member-change broadcasts so that when someone is added or
 * joins, every other member viewing the circle sees the roster update live (not just
 * the actor). The server broadcasts `member_changed` on `circle:{id}:members`
 * (see app/api/circles/[id]/members POST and app/api/circles/join POST).
 * On any event we invalidate the CircleMembers + CircleDetails caches, triggering a refetch.
 */
export function useCircleMembersRealtime(circleId: string | undefined) {
	const dispatch = useDispatch();

	useEffect(() => {
		if (!circleId) return;
		const supabase = createBrowserSupabaseClient();
		if (!supabase) return;

		const channel = supabase.channel(`circle:${circleId}:members`);
		channel
			.on('broadcast', { event: 'member_changed' }, () => {
				dispatch(
					circlesApi.util.invalidateTags([
						{ type: 'CircleMembers', id: circleId },
						{ type: 'CircleDetails', id: circleId },
					]),
				);
			})
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [circleId, dispatch]);
}
