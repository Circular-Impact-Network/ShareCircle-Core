'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import { ChatContainer } from './ChatContainer';
import { GlobalPresenceProvider } from '@/hooks/useGlobalPresence';

type ChatThreadPageProps = {
	threadId: string;
};

export function ChatThreadPage({ threadId }: ChatThreadPageProps) {
	const router = useRouter();
	const { data: session } = useSession();

	useEffect(() => {
		if (!threadId) {
			router.replace('/messages');
		}
	}, [threadId, router]);

	return (
		<GlobalPresenceProvider userId={session?.user?.id || null}>
			<div className="space-y-4">
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="sm" onClick={() => router.push('/messages')}>
						<ChevronLeft className="h-4 w-4" />
						Back
					</Button>
				</div>
				<ChatContainer initialThreadId={threadId} hideList fullBleed />
			</div>
		</GlobalPresenceProvider>
	);
}
