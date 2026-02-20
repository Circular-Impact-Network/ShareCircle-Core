'use client';

// Thread-only view with initialThreadId, initialDraft, fullBleed
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
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
			<div className="relative">
				{/* Only show back button on mobile - desktop shows the full chat list */}
				{!isDesktop && (
					<Button
						variant="ghost"
						size="icon"
						onClick={() => router.push('/messages')}
						className="absolute left-4 top-4 z-10 bg-background/80 backdrop-blur-sm hover:bg-background shadow-sm"
					>
						<ArrowLeft className="h-4 w-4" />
						<span className="sr-only">Back to Messages</span>
					</Button>
				)}
				{/* On desktop, show chat list alongside the thread; on mobile, hide the list */}
				<ChatContainer 
					initialThreadId={threadId} 
					initialMessageDraft={initialDraft}
					hideList={!isDesktop} 
					fullBleed 
				/>
			</div>
		</GlobalPresenceProvider>
	);
}
