'use client';

import { useSession } from 'next-auth/react';
import { ChatContainer } from '@/components/chat/ChatContainer';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { GlobalPresenceProvider } from '@/hooks/useGlobalPresence';

export function MessagesPage() {
	const { data: session } = useSession();
	const isDesktop = useMediaQuery('(min-width: 768px)');

	return (
		<GlobalPresenceProvider userId={session?.user?.id || null}>
			<ChatContainer showListOnly={!isDesktop} fullBleed />
		</GlobalPresenceProvider>
	);
}
