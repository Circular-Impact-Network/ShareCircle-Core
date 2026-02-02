'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
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
			<div className="relative">
				<Button
					variant="ghost"
					size="icon"
					onClick={() => router.push('/messages')}
					className="absolute left-4 top-4 z-10 bg-background/80 backdrop-blur-sm hover:bg-background shadow-sm"
				>
					<ArrowLeft className="h-4 w-4" />
					<span className="sr-only">Back to Messages</span>
				</Button>
				<ChatContainer initialThreadId={threadId} hideList fullBleed />
			</div>
		</GlobalPresenceProvider>
	);
}
