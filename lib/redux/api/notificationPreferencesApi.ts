import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { NotificationCategoryDefinition } from '@/lib/notification-catalog';

export type NotificationChannelOverride = {
	inApp?: boolean;
	push?: boolean;
};

export type NotificationPreferencesStored = {
	globalInApp: boolean;
	globalPush: boolean;
	categoryOverrides: Record<string, NotificationChannelOverride>;
	typeOverrides: Record<string, NotificationChannelOverride>;
};

export type NotificationChannelsEffective = {
	inApp: boolean;
	push: boolean;
};

export type NotificationPreferencesResponse = {
	catalog: NotificationCategoryDefinition[];
	stored: NotificationPreferencesStored;
	effectiveByType: Record<string, NotificationChannelsEffective>;
	pushConfigured: boolean;
};

export type NotificationPreferencesPatch = {
	globalInApp?: boolean;
	globalPush?: boolean;
	categoryOverrides?: Record<string, NotificationChannelOverride>;
	typeOverrides?: Record<string, NotificationChannelOverride>;
};

export type NotificationPreferencesPatchResponse = {
	stored: NotificationPreferencesStored;
	effectiveByType: Record<string, NotificationChannelsEffective>;
	pushConfigured: boolean;
};

export const notificationPreferencesApi = createApi({
	reducerPath: 'notificationPreferencesApi',
	baseQuery: fetchBaseQuery({
		baseUrl: '/api',
		credentials: 'include',
	}),
	keepUnusedDataFor: 600,
	tagTypes: ['NotificationPreferences'],
	endpoints: builder => ({
		getNotificationPreferences: builder.query<NotificationPreferencesResponse, void>({
			query: () => '/user/notification-preferences',
			providesTags: ['NotificationPreferences'],
		}),
		updateNotificationPreferences: builder.mutation<
			NotificationPreferencesPatchResponse,
			NotificationPreferencesPatch
		>({
			query: body => ({
				url: '/user/notification-preferences',
				method: 'PATCH',
				body,
			}),
			invalidatesTags: ['NotificationPreferences'],
		}),
	}),
});

export const { useGetNotificationPreferencesQuery, useUpdateNotificationPreferencesMutation } =
	notificationPreferencesApi;
