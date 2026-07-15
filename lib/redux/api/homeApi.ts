import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Notification } from './notificationsApi';
import type { BorrowRequest, ItemRequest } from './borrowApi';
import type { Circle } from './circlesApi';
import type { User } from './userApi';

// Union of the individual dashboard queries, served by /api/home/summary in one round-trip.
export interface HomeSummary {
	user: User | null;
	notifications: { items: Notification[]; unreadCount: number };
	unreadMessages: { unreadCount: number };
	pendingBorrowRequests: BorrowRequest[];
	openItemRequests: ItemRequest[];
	circles: Circle[];
}

export const homeApi = createApi({
	reducerPath: 'homeApi',
	baseQuery: fetchBaseQuery({ baseUrl: '/api', credentials: 'include' }),
	keepUnusedDataFor: 60,
	refetchOnReconnect: true,
	refetchOnFocus: true,
	endpoints: builder => ({
		getHomeSummary: builder.query<HomeSummary, void>({
			query: () => '/home/summary',
		}),
	}),
});

export const { useGetHomeSummaryQuery } = homeApi;
