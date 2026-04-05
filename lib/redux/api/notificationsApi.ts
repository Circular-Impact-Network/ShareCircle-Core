import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { NotificationType, NotificationStatus } from '@prisma/client';

// Types
export interface Notification {
	id: string;
	type: NotificationType;
	entityId: string | null;
	title: string;
	body: string;
	metadata: Record<string, unknown> | null;
	status: NotificationStatus;
	createdAt: string;
	readAt: string | null;
}

export interface NotificationsResponse {
	notifications: Notification[];
	pagination: {
		total: number;
		limit: number;
		offset: number;
		hasMore: boolean;
	};
	unreadCount: number;
	tabCounts: {
		alerts: number;
		requests: number;
	};
}

export interface GetNotificationsFilters {
	tab?: 'alerts' | 'requests';
	status?: NotificationStatus;
	limit?: number;
	offset?: number;
}

export const notificationsApi = createApi({
	reducerPath: 'notificationsApi',
	baseQuery: fetchBaseQuery({
		baseUrl: '/api',
		credentials: 'include',
	}),
	keepUnusedDataFor: 60,
	refetchOnFocus: true,
	refetchOnReconnect: true,
	tagTypes: ['Notifications'],
	endpoints: builder => ({
		// Get unread notification count (lightweight)
		getUnreadNotificationCount: builder.query<{ unreadCount: number }, void>({
			query: () => '/notifications/unread-count',
			providesTags: ['Notifications'],
		}),

		// Get notifications
		getNotifications: builder.query<NotificationsResponse, GetNotificationsFilters | void>({
			query: (filters = {}) => {
				const params = new URLSearchParams();
				if (filters && typeof filters === 'object') {
					const { tab, status, limit, offset } = filters;
					if (tab) params.append('tab', tab);
					if (status) params.append('status', status);
					if (limit) params.append('limit', limit.toString());
					if (offset) params.append('offset', offset.toString());
				}
				const queryString = params.toString();
				return `/notifications${queryString ? `?${queryString}` : ''}`;
			},
			providesTags: ['Notifications'],
		}),

		// Mark notification as read
		markAsRead: builder.mutation<Notification | { message: string }, string>({
			query: id => ({
				url: `/notifications/${id}/read`,
				method: 'PATCH',
			}),
			invalidatesTags: ['Notifications'],
		}),

		// Mark all notifications as read
		markAllAsRead: builder.mutation<{ message: string }, void>({
			query: () => ({
				url: '/notifications/all/read',
				method: 'PATCH',
			}),
			invalidatesTags: ['Notifications'],
		}),

		// Clear notifications
		clearNotifications: builder.mutation<{ message: string }, { tab?: 'alerts' | 'requests' } | void>({
			query: (params = {}) => {
				const queryParams = new URLSearchParams();
				if (params && typeof params === 'object' && params.tab) {
					queryParams.append('tab', params.tab);
				}
				const queryString = queryParams.toString();
				return {
					url: `/notifications${queryString ? `?${queryString}` : ''}`,
					method: 'DELETE',
				};
			},
			invalidatesTags: ['Notifications'],
		}),
	}),
});

export const {
	useGetUnreadNotificationCountQuery,
	useGetNotificationsQuery,
	useMarkAsReadMutation,
	useMarkAllAsReadMutation,
	useClearNotificationsMutation,
} = notificationsApi;
