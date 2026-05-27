'use client';

import { useState } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useToast } from '@/hooks/useToast';
import {
	useRespondToItemRequestMutation,
	useIgnoreItemRequestMutation,
	useUpdateItemRequestMutation,
} from '@/lib/redux/api/borrowApi';
import { openDirectChat } from '@/lib/chat-navigation';

// Encapsulates the item-request action handlers historically inlined in
// notifications-page (respond, open chat, ignore, close). Owns its
// respondingRequestId state so the page doesn't have to.
export function useItemRequestNotificationActions({ router }: { router: AppRouterInstance }) {
	const { toast } = useToast();
	const [respondToItemRequest] = useRespondToItemRequestMutation();
	const [ignoreItemRequest] = useIgnoreItemRequestMutation();
	const [updateItemRequest] = useUpdateItemRequestMutation();

	const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);

	const openItemRequestChat = (
		requesterId: string,
		requestId: string,
		requestTitleText: string,
		opts?: { draft?: string },
	) =>
		openDirectChat(router, {
			otherUserId: requesterId,
			contextRef: { type: 'item-request', id: requestId, title: requestTitleText },
			draft: opts?.draft,
		});

	const handleRespond = async (requestId: string, requesterId: string, requestTitleText: string) => {
		setRespondingRequestId(requestId);
		try {
			await respondToItemRequest(requestId).unwrap();
			const draft = `I have this item and can help with your request: "${requestTitleText}".`;
			await openItemRequestChat(requesterId, requestId, requestTitleText, { draft });
		} catch (error) {
			console.error('Respond to item request error:', error);
			toast({
				title: 'Unable to respond',
				description: error instanceof Error ? error.message : 'Please try again.',
				variant: 'destructive',
			});
		} finally {
			setRespondingRequestId(null);
		}
	};

	const handleOpenChat = async (requesterId: string, requestId: string, requestTitleText: string) => {
		try {
			await openItemRequestChat(requesterId, requestId, requestTitleText);
		} catch (error) {
			console.error('Open item request chat error:', error);
			toast({
				title: 'Unable to open chat',
				description: error instanceof Error ? error.message : 'Please try again.',
				variant: 'destructive',
			});
		}
	};

	const handleIgnore = async (requestId: string) => {
		try {
			await ignoreItemRequest(requestId).unwrap();
			toast({ title: 'Request ignored' });
		} catch {
			toast({ title: 'Failed to ignore request', variant: 'destructive' });
		}
	};

	const handleCloseRequest = async (requestId: string) => {
		try {
			await updateItemRequest({ id: requestId, status: 'CANCELLED' }).unwrap();
			toast({ title: 'Request closed' });
		} catch {
			toast({ title: 'Failed to close request', variant: 'destructive' });
		}
	};

	return {
		respondingRequestId,
		handleRespond,
		handleOpenChat,
		handleIgnore,
		handleCloseRequest,
	};
}
