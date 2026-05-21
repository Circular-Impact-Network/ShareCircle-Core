import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { ContextRef } from '@/lib/chat-context-ref';
import { buildContextRefParam } from '@/lib/chat-context-ref';

type Router = Pick<AppRouterInstance, 'push'>;

export type OpenDirectChatOptions = {
	otherUserId: string;
	contextRef?: ContextRef | null;
	draft?: string | null;
	// Optional injection of the thread-create call. Pages that already hold
	// a `useCreateThreadMutation` trigger can pass its unwrapped variant in;
	// callers that don't fall through to a direct fetch.
	createThread?: (args: { otherUserId: string }) => Promise<{ id: string }>;
};

async function defaultCreateThread({ otherUserId }: { otherUserId: string }): Promise<{ id: string }> {
	const response = await fetch('/api/messages/threads', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ otherUserId }),
	});
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.error || 'Failed to start conversation');
	}
	return response.json();
}

// Builds the `/messages/<threadId>?...` href given optional context and draft.
export function buildMessagesThreadHref(
	threadId: string,
	opts?: { contextRef?: ContextRef | null; draft?: string | null },
): string {
	const params: string[] = [];
	if (opts?.contextRef) params.push(buildContextRefParam(opts.contextRef));
	if (opts?.draft) params.push(`draft=${encodeURIComponent(opts.draft)}`);
	return params.length === 0 ? `/messages/${threadId}` : `/messages/${threadId}?${params.join('&')}`;
}

// Canonical "open chat about X" entrypoint used by item-detail, browse,
// item-requests, notifications, and circle-details. Creates (or finds) the
// direct thread with `otherUserId`, then navigates to it with the optional
// context-ref chip and message draft pre-filled.
export async function openDirectChat(router: Router, opts: OpenDirectChatOptions): Promise<string> {
	const { otherUserId, contextRef, draft, createThread } = opts;
	const thread = await (createThread ?? defaultCreateThread)({ otherUserId });
	const href = buildMessagesThreadHref(thread.id, { contextRef, draft });
	router.push(href);
	return thread.id;
}
