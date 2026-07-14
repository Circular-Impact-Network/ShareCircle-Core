import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export interface UserImpact {
	itemsShared: number;
	timesLent: number;
	timesBorrowed: number;
	moneySavedUsd: number;
	co2AvoidedKg: number;
}

export interface CircleImpact {
	circleId: string;
	circleName: string | null;
	totalMembers: number;
	totalBorrows: number;
	uniqueBorrowers: number;
	uniqueLenders: number;
	ghgSavedKg: number;
	weightDivertedKg: number;
	borrowerSavingsUsd: number;
	retailValueSharedUsd: number;
	repeatBorrowerRate: number;
}

export interface CircleMemberImpact {
	userId: string;
	userName: string | null;
	memberRole: string;
	borrowsInCircle: number;
	lendsInCircle: number;
	ghgSavedKg: number;
	savingsUsd: number;
	valueSharedUsd: number;
}

export interface CircleImpactResponse {
	summary: CircleImpact | null;
	members: CircleMemberImpact[];
	isAdmin: boolean;
}

export const impactApi = createApi({
	reducerPath: 'impactApi',
	baseQuery: fetchBaseQuery({ baseUrl: '/api', credentials: 'include' }),
	keepUnusedDataFor: 120,
	refetchOnReconnect: true,
	endpoints: builder => ({
		getUserImpact: builder.query<UserImpact, void>({
			query: () => '/impact',
		}),
		getCircleImpact: builder.query<CircleImpactResponse, string>({
			query: circleId => `/circles/${circleId}/impact`,
		}),
	}),
});

export const { useGetUserImpactQuery, useGetCircleImpactQuery } = impactApi;
