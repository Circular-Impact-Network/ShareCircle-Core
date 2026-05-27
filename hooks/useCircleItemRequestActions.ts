'use client';

import { useState } from 'react';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useToast } from '@/hooks/useToast';
import {
	useIgnoreItemRequestMutation,
	useRespondToItemRequestMutation,
	useUpdateItemRequestMutation,
} from '@/lib/redux/api/borrowApi';
import { useCreateThreadMutation } from '@/lib/redux/api/messagesApi';
import { openDirectChat } from '@/lib/chat-navigation';

// Encapsulates the item-request action handlers that live inside the
// circle-details page (respond, ignore, close). Mirrors the notifications-page
// variant but bound to circle-scoped state (e.g., per-respond loading).
export function useCircleItemRequestActions({ router }: { router: AppRouterInstance }) {
	const { toast } = useToast();
	const [respondToItemRequest] = useRespondToItemRequestMutation();
	const [ignoreItemRequest] = useIgnoreItemRequestMutation();
	const [updateItemRequest] = useUpdateItemRequestMutation();
	const [createThread] = useCreateThreadMutation();

	const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);

	const handleRespond = async (requestId: string, requesterId: string, requestTitle: string) => {
		setRespondingRequestId(requestId);
		try {
			await respondToItemRequest(requestId).unwrap();
			await openDirectChat(router, {
				otherUserId: requesterId,
				contextRef: { type: 'item-request', id: requestId, title: requestTitle },
				draft: `I have this item and can help with your request: "${requestTitle}".`,
				createThread: args => createThread(args).unwrap(),
			});
		} catch (error) {
			console.error('Respond error:', error);
			toast({ title: 'Unable to respond', variant: 'destructive' });
		} finally {
			setRespondingRequestId(null);
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

	const handleClose = async (requestId: string) => {
		try {
			await updateItemRequest({ id: requestId, status: 'CANCELLED' }).unwrap();
			toast({ title: 'Request closed' });
		} catch {
			toast({ title: 'Failed to close request', variant: 'destructive' });
		}
	};

	return { respondingRequestId, handleRespond, handleIgnore, handleClose };
}
