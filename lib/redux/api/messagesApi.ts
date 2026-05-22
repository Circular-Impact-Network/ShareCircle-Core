import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { ChatThread } from '@/components/chat/types';

export interface UnreadCountResponse {
	unreadCount: number;
}

export interface CreateThreadResponse {
	id: string;
}

export const messagesApi = createApi({
	reducerPath: 'messagesApi',
	baseQuery: fetchBaseQuery({
		baseUrl: '/api/messages',
		credentials: 'include',
	}),
	keepUnusedDataFor: 120,
	refetchOnFocus: true,
	refetchOnReconnect: true,
	tagTypes: ['UnreadCount', 'Threads'],
	endpoints: builder => ({
		// Get total unread message count
		getUnreadMessageCount: builder.query<UnreadCountResponse, void>({
			query: () => '/unread-count',
			providesTags: ['UnreadCount'],
		}),

		// Get or create a direct message thread with another user
		createThread: builder.mutation<CreateThreadResponse, { otherUserId: string }>({
			query: body => ({
				url: '/threads',
				method: 'POST',
				body,
			}),
			invalidatesTags: ['Threads'],
		}),

		// Get recent chat threads
		getRecentThreads: builder.query<ChatThread[], { limit?: number } | void>({
			query: params => {
				const searchParams = new URLSearchParams();
				if (params && typeof params === 'object' && params.limit) {
					searchParams.append('limit', String(params.limit));
				}
				const qs = searchParams.toString();
				return `/threads${qs ? `?${qs}` : ''}`;
			},
			providesTags: ['Threads'],
		}),

		// ---------- Thread state mutations (idempotent, simple shape) ----------

		togglePinThread: builder.mutation<void, { threadId: string; pinned: boolean }>({
			query: ({ threadId, pinned }) => ({
				url: `/threads/${threadId}/pin`,
				method: 'PATCH',
				body: { pinned },
			}),
			invalidatesTags: ['Threads'],
		}),

		setThreadArchived: builder.mutation<void, { threadId: string; archived: boolean }>({
			query: ({ threadId, archived }) => ({
				url: `/threads/${threadId}/archive`,
				method: 'POST',
				body: { archived },
			}),
			invalidatesTags: ['Threads'],
		}),
	}),
});

export const { useGetUnreadMessageCountQuery, useGetRecentThreadsQuery, useCreateThreadMutation } = messagesApi;
