'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ChatContainer } from './ChatContainer';
import { GlobalPresenceProvider } from '@/hooks/useGlobalPresence';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type ChatThreadPageProps = {
	threadId: string;
	initialDraft?: string | null;
};

export function ChatThreadPage({ threadId, initialDraft = null }: ChatThreadPageProps) {
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
				hideList={!isDesktop}
				fullBleed
			/>
		</GlobalPresenceProvider>
	);
}
