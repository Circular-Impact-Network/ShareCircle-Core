import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface UnreadCountResponse {
	unreadCount: number;
}

export const messagesApi = createApi({
	reducerPath: 'messagesApi',
	baseQuery: fetchBaseQuery({
		baseUrl: '/api/messages',
		credentials: 'include',
	}),
	tagTypes: ['UnreadCount'],
	endpoints: builder => ({
		// Get total unread message count
		getUnreadMessageCount: builder.query<UnreadCountResponse, void>({
			query: () => '/unread-count',
			providesTags: ['UnreadCount'],
		}),
	}),
});

export const { useGetUnreadMessageCountQuery } = messagesApi;
