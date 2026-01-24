import { use } from 'react';
import { ChatThreadPage } from '@/components/chat/ChatThreadPage';

type MessagesThreadRouteProps = {
	params: Promise<{ id: string }>;
};

export default function MessagesThreadRoute({ params }: MessagesThreadRouteProps) {
	const { id } = use(params);
	return <ChatThreadPage threadId={id} />;
}
