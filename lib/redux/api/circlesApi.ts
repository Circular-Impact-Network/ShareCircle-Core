import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { MemberRole, JoinType } from '@prisma/client';

// Types
export interface UserInfo {
	id: string;
	name: string | null;
	image: string | null;
	email?: string | null;
}

export interface CircleMember {
	id: string;
	userId: string;
	name: string | null;
	email: string | null;
	image: string | null;
	role: MemberRole;
	joinType: JoinType;
	joinedAt: string;
}

export interface MemberPreview {
	id: string;
	name: string | null;
	image: string | null;
}

export interface Circle {
	id: string;
	name: string;
	description: string | null;
	inviteCode: string;
	inviteExpiresAt: string;
	avatarUrl: string | null;
	createdAt: string;
	updatedAt?: string;
	createdBy: UserInfo;
	membersCount: number;
	userRole: MemberRole | null;
	memberPreviews?: MemberPreview[];
}

export interface CircleDetails extends Circle {
	members: CircleMember[];
}

export interface CreateCircleInput {
	name: string;
	description?: string;
}

export interface UpdateCircleInput {
	id: string;
	name?: string;
	description?: string;
	avatarUrl?: string;
}

export interface JoinCircleInput {
	code: string;
	joinType?: 'CODE' | 'LINK';
}

export interface UpdateMemberRoleInput {
	circleId: string;
	userId: string;
	role: MemberRole;
}

export interface RemoveMemberInput {
	circleId: string;
	userId: string;
}

export interface UploadAvatarResponse {
	avatarUrl: string;
	avatarPath: string;
}

export const circlesApi = createApi({
	reducerPath: 'circlesApi',
	baseQuery: fetchBaseQuery({
		baseUrl: '/api',
		credentials: 'include',
	}),
	keepUnusedDataFor: 300,
	refetchOnReconnect: true,
	tagTypes: ['Circles', 'CircleDetails', 'CircleMembers'],
	endpoints: builder => ({
		// Get all circles the user is a member of
		getCircles: builder.query<Circle[], void>({
			query: () => '/circles',
			providesTags: result =>
				result
					? [...result.map(({ id }) => ({ type: 'Circles' as const, id })), { type: 'Circles', id: 'LIST' }]
					: [{ type: 'Circles', id: 'LIST' }],
		}),

		// Get a single circle with full details including members
		getCircle: builder.query<CircleDetails, string>({
			query: id => `/circles/${id}`,
			providesTags: (_result, _error, id) => [
				{ type: 'CircleDetails', id },
				{ type: 'CircleMembers', id },
			],
		}),

		// Create a new circle
		createCircle: builder.mutation<Circle, CreateCircleInput>({
			query: body => ({
				url: '/circles',
				method: 'POST',
				body,
			}),
			invalidatesTags: [{ type: 'Circles', id: 'LIST' }],
		}),

		// Update circle details (admin only)
		updateCircle: builder.mutation<Circle, UpdateCircleInput>({
			query: ({ id, ...body }) => ({
				url: `/circles/${id}`,
				method: 'PUT',
				body,
			}),
			invalidatesTags: (_result, _error, { id }) => [
				{ type: 'Circles', id },
				{ type: 'Circles', id: 'LIST' },
				{ type: 'CircleDetails', id },
			],
		}),

		// Delete a circle (admin only)
		deleteCircle: builder.mutation<{ message: string }, string>({
			query: id => ({
				url: `/circles/${id}`,
				method: 'DELETE',
			}),
			invalidatesTags: (_result, _error, id) => [
				{ type: 'Circles', id },
				{ type: 'Circles', id: 'LIST' },
				{ type: 'CircleDetails', id },
			],
		}),

		// Join a circle via invite code
		joinCircle: builder.mutation<Circle & { message: string }, JoinCircleInput>({
			query: body => ({
				url: '/circles/join',
				method: 'POST',
				body,
			}),
			invalidatesTags: [{ type: 'Circles', id: 'LIST' }],
		}),

		// Regenerate invite code (admin only)
		regenerateInviteCode: builder.mutation<{ inviteCode: string; inviteExpiresAt: string }, string>({
			query: id => ({
				url: `/circles/${id}/regenerate-code`,
				method: 'POST',
			}),
			invalidatesTags: (_result, _error, id) => [
				{ type: 'Circles', id },
				{ type: 'CircleDetails', id },
			],
		}),

		// Update member role (admin only)
		updateMemberRole: builder.mutation<{ message: string }, UpdateMemberRoleInput>({
			query: ({ circleId, userId, role }) => ({
				url: `/circles/${circleId}/members/${userId}`,
				method: 'PATCH',
				body: { role },
			}),
			invalidatesTags: (_result, _error, { circleId }) => [
				{ type: 'CircleDetails', circleId },
				{ type: 'CircleMembers', id: circleId },
			],
		}),

		// Remove member from circle (admin only)
		removeMember: builder.mutation<{ message: string }, RemoveMemberInput>({
			query: ({ circleId, userId }) => ({
				url: `/circles/${circleId}/members/${userId}`,
				method: 'DELETE',
			}),
			invalidatesTags: (_result, _error, { circleId }) => [
				{ type: 'Circles', id: circleId },
				{ type: 'Circles', id: 'LIST' },
				{ type: 'CircleDetails', id: circleId },
				{ type: 'CircleMembers', id: circleId },
			],
		}),

		// Leave circle (self)
		leaveCircle: builder.mutation<{ message: string }, string>({
			query: circleId => ({
				url: `/circles/${circleId}/members`,
				method: 'DELETE',
			}),
			invalidatesTags: (_result, _error, circleId) => [
				{ type: 'Circles', id: circleId },
				{ type: 'Circles', id: 'LIST' },
				{ type: 'CircleDetails', id: circleId },
			],
		}),

		// Upload circle avatar (admin only)
		uploadCircleAvatar: builder.mutation<UploadAvatarResponse, { circleId: string; file: File }>({
			query: ({ circleId, file }) => {
				const formData = new FormData();
				formData.append('file', file);
				return {
					url: `/circles/${circleId}/avatar`,
					method: 'POST',
					body: formData,
				};
			},
			invalidatesTags: (_result, _error, { circleId }) => [
				{ type: 'Circles', id: circleId },
				{ type: 'Circles', id: 'LIST' },
				{ type: 'CircleDetails', id: circleId },
			],
		}),
	}),
});

export const {
	useGetCirclesQuery,
	useGetCircleQuery,
	useCreateCircleMutation,
	useUpdateCircleMutation,
	useDeleteCircleMutation,
	useJoinCircleMutation,
	useRegenerateInviteCodeMutation,
	useUpdateMemberRoleMutation,
	useRemoveMemberMutation,
	useLeaveCircleMutation,
	useUploadCircleAvatarMutation,
} = circlesApi;
