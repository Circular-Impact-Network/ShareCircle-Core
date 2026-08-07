'use client';

import { useEffect } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useDispatch } from 'react-redux';
import { createBrowserSupabaseClient, ensureRealtimeAuth, reportSubscription } from '@/lib/supabaseBrowser';
import { PRIVATE_CHANNEL } from '@/lib/realtime-channels';
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

		let channel: RealtimeChannel | null = null;
		let cancelled = false;

		void ensureRealtimeAuth(supabase)
			.then(() => {
				if (cancelled) return;

				channel = supabase.channel(`circle:${circleId}:members`, PRIVATE_CHANNEL);
				channel
					.on('broadcast', { event: 'member_changed' }, () => {
						dispatch(
							circlesApi.util.invalidateTags([
								{ type: 'CircleMembers', id: circleId },
								{ type: 'CircleDetails', id: circleId },
							]),
						);
					})
					.subscribe(reportSubscription(`circle:${circleId}:members`));
			})
			.catch(error => {
				console.error('Realtime auth failed; live member updates are disabled:', error);
			});

		return () => {
			cancelled = true;
			if (channel) supabase.removeChannel(channel);
		};
	}, [circleId, dispatch]);
}
