// Passes initialDraft and initialContextRef from search params to ChatThreadPage
import { use } from 'react';
import { ChatThreadPage } from '@/components/chat/ChatThreadPage';
import { parseContextRefParam } from '@/lib/chat-context-ref';

type MessagesThreadRouteProps = {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ draft?: string; context?: string }>;
};

export default function MessagesThreadRoute({ params, searchParams }: MessagesThreadRouteProps) {
	const { id } = use(params);
	const { draft, context } = use(searchParams);
	return (
		<ChatThreadPage threadId={id} initialDraft={draft ?? null} initialContextRef={parseContextRefParam(context)} />
	);
}
