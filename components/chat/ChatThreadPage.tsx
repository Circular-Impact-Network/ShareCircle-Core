'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChatContainer } from './ChatContainer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { ContextRef } from './types';

type ChatThreadPageProps = {
	threadId: string;
	initialDraft?: string | null;
	initialContextRef?: ContextRef | null;
};

export function ChatThreadPage({ threadId, initialDraft = null, initialContextRef = null }: ChatThreadPageProps) {
	const router = useRouter();
	const isDesktop = useMediaQuery('(min-width: 768px)');

	useEffect(() => {
		if (!threadId) {
			router.replace('/messages');
		}
	}, [threadId, router]);

	// Presence is provided app-wide by the authenticated layout's GlobalPresenceProvider.
	// On desktop: show chat list alongside thread. On mobile: thread-only with back button in ChatHeader.
	return (
		<ChatContainer
			initialThreadId={threadId}
			initialMessageDraft={initialDraft}
			initialContextRef={initialContextRef}
			hideList={!isDesktop}
			fullBleed
		/>
	);
}
