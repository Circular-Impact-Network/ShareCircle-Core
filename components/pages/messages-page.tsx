'use client';

import { ChatContainer } from '@/components/chat/ChatContainer';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export function MessagesPage() {
	const isDesktop = useMediaQuery('(min-width: 768px)');

	// Presence is provided app-wide by the authenticated layout's GlobalPresenceProvider.
	return <ChatContainer showListOnly={!isDesktop} fullBleed />;
}
