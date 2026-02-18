import { use } from 'react';
import { ChatThreadPage } from '@/components/chat/ChatThreadPage';

type MessagesThreadRouteProps = {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ draft?: string }>;
};

export default function MessagesThreadRoute({ params, searchParams }: MessagesThreadRouteProps) {
	const { id } = use(params);
	const { draft } = use(searchParams);
	return <ChatThreadPage threadId={id} initialDraft={draft ?? null} />;
}
