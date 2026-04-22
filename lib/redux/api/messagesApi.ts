import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { ChatThread } from '@/components/chat/types';

export interface UnreadCountResponse {
	unreadCount: number;
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
	}),
});

export const { useGetUnreadMessageCountQuery, useGetRecentThreadsQuery } = messagesApi;
