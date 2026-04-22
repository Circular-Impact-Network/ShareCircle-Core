import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface User {
	id: string;
	name: string | null;
	email: string | null;
	image: string | null;
	phoneNumber: string | null;
	countryCode: string | null;
	bio: string | null;
	createdAt: string;
}

export interface UpdateUserRequest {
	name?: string;
	bio?: string;
	image?: string;
	phoneNumber?: string;
	countryCode?: string;
}

export interface UploadImageResponse {
	url: string;
	path: string;
}

export const userApi = createApi({
	reducerPath: 'userApi',
	baseQuery: fetchBaseQuery({
		baseUrl: '/api',
		credentials: 'include',
	}),
	keepUnusedDataFor: 300,
	refetchOnReconnect: true,
	tagTypes: ['User'],
	endpoints: builder => ({
		getUser: builder.query<User, void>({
			query: () => '/user',
			providesTags: ['User'],
		}),
		updateUser: builder.mutation<User, UpdateUserRequest>({
			query: body => ({
				url: '/user/update',
				method: 'PATCH',
				body,
			}),
			invalidatesTags: ['User'],
		}),
		uploadImage: builder.mutation<UploadImageResponse, File>({
			query: file => {
				const formData = new FormData();
				formData.append('file', file);
				return {
					url: '/upload/image',
					method: 'POST',
					body: formData,
				};
			},
		}),
	}),
});

export const { useGetUserQuery, useUpdateUserMutation, useUploadImageMutation } = userApi;
