'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChatContainer } from './ChatContainer';
import { GlobalPresenceProvider } from '@/hooks/useGlobalPresence';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { ContextRef } from './types';

type ChatThreadPageProps = {
	threadId: string;
	initialDraft?: string | null;
	initialContextRef?: ContextRef | null;
};

export function ChatThreadPage({ threadId, initialDraft = null, initialContextRef = null }: ChatThreadPageProps) {
	const router = useRouter();
	const { data: session } = useSession();
	const isDesktop = useMediaQuery('(min-width: 768px)');

	useEffect(() => {
		if (!threadId) {
			router.replace('/messages');
		}
	}, [threadId, router]);

	return (
		<GlobalPresenceProvider userId={session?.user?.id || null}>
			{/* On desktop: show chat list alongside thread. On mobile: thread-only with back button in ChatHeader. */}
			<ChatContainer
				initialThreadId={threadId}
				initialMessageDraft={initialDraft}
				initialContextRef={initialContextRef}
				hideList={!isDesktop}
				fullBleed
			/>
		</GlobalPresenceProvider>
	);
}
