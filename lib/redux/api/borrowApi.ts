import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
	ItemRequestStatus,
	BorrowRequestStatus,
	BorrowQueueStatus,
	BorrowTransactionStatus,
} from '@prisma/client';

// Types (ItemRequest supports multi-circle via circles array)
export interface UserInfo {
	id: string;
	name: string | null;
	image: string | null;
}

export interface CircleInfo {
	id: string;
	name: string;
}

export interface ItemInfo {
	id: string;
	name: string;
	imageUrl: string;
	imagePath: string;
	isAvailable?: boolean;
	description?: string | null;
}

// Item Request Types
export interface ItemRequest {
	id: string;
	title: string;
	description: string | null;
	desiredFrom: string | null;
	desiredTo: string | null;
	status: ItemRequestStatus;
	fulfilledBy: string | null;
	createdAt: string;
	updatedAt: string;
	requester: UserInfo;
	circle: CircleInfo | null;
	circles: { circle: CircleInfo }[];
	isIgnored?: boolean;
	isResponded?: boolean;
}

export interface CreateItemRequestInput {
	title: string;
	description?: string;
	circleIds: string[];
	desiredFrom?: string;
	desiredTo?: string;
}

export interface GetItemRequestsFilters {
	circleId?: string;
	status?: ItemRequestStatus;
	myRequests?: boolean;
	includeIgnored?: boolean;
}

// Borrow Request Types
export interface BorrowTransaction {
	id: string;
	status: BorrowTransactionStatus;
	borrowedAt: string;
	dueAt: string;
	returnedAt: string | null;
}

export interface BorrowRequest {
	id: string;
	message: string | null;
	desiredFrom: string;
	desiredTo: string;
	status: BorrowRequestStatus;
	declineNote: string | null;
	createdAt: string;
	updatedAt: string;
	item: ItemInfo;
	requester: UserInfo;
	owner: UserInfo;
	transaction?: BorrowTransaction | null;
}

export interface CreateBorrowRequestInput {
	itemId: string;
	message?: string;
	desiredFrom: string;
	desiredTo: string;
	joinQueue?: boolean;
}

export interface GetBorrowRequestsFilters {
	type?: 'incoming' | 'outgoing' | 'all';
	status?: BorrowRequestStatus;
	itemId?: string;
}

export interface BorrowRequestActionInput {
	id: string;
	action: 'approve' | 'decline' | 'cancel';
	declineNote?: string;
}

// Queue Types
export interface BorrowQueueEntry {
	id: string;
	position: number;
	message: string | null;
	desiredFrom: string | null;
	desiredTo: string | null;
	status: BorrowQueueStatus;
	createdAt: string;
	item: ItemInfo & {
		ownerId: string;
		owner: UserInfo;
	};
	requester: UserInfo;
}

// Transaction Types
export interface FullTransaction {
	id: string;
	borrowRequestId: string;
	status: BorrowTransactionStatus;
	borrowedAt: string;
	dueAt: string;
	returnedAt: string | null;
	returnNote: string | null;
	createdAt: string;
	item: ItemInfo;
	borrower: UserInfo;
	owner: UserInfo;
	borrowRequest: {
		id: string;
		message: string | null;
		desiredFrom: string;
		desiredTo: string;
	};
}

export interface GetTransactionsFilters {
	role?: 'borrower' | 'owner';
	status?: BorrowTransactionStatus;
	itemId?: string;
}

export const borrowApi = createApi({
	reducerPath: 'borrowApi',
	baseQuery: fetchBaseQuery({
		baseUrl: '/api',
		credentials: 'include',
	}),
	keepUnusedDataFor: 90,
	refetchOnFocus: true,
	refetchOnReconnect: true,
	tagTypes: ['ItemRequests', 'BorrowRequests', 'BorrowQueue', 'Transactions', 'Items'],
	endpoints: builder => ({
		// ===== Item Requests =====

		// Get item requests
		getItemRequests: builder.query<ItemRequest[], GetItemRequestsFilters | void>({
			query: (filters = {}) => {
				const params = new URLSearchParams();
				if (filters && typeof filters === 'object') {
					const { circleId, status, myRequests, includeIgnored } = filters;
					if (circleId) params.append('circleId', circleId);
					if (status) params.append('status', status);
					if (myRequests) params.append('myRequests', 'true');
					if (includeIgnored) params.append('includeIgnored', 'true');
				}
				const queryString = params.toString();
				return `/item-requests${queryString ? `?${queryString}` : ''}`;
			},
			providesTags: ['ItemRequests'],
		}),

		// Get single item request
		getItemRequest: builder.query<ItemRequest, string>({
			query: id => `/item-requests/${id}`,
			providesTags: (_result, _error, id) => [{ type: 'ItemRequests', id }],
		}),

		// Create item request
		createItemRequest: builder.mutation<ItemRequest, CreateItemRequestInput>({
			query: body => ({
				url: '/item-requests',
				method: 'POST',
				body,
			}),
			invalidatesTags: ['ItemRequests'],
		}),

		// Update item request (fulfill/cancel)
		updateItemRequest: builder.mutation<ItemRequest, { id: string; status: ItemRequestStatus; fulfilledBy?: string }>({
			query: ({ id, ...body }) => ({
				url: `/item-requests/${id}`,
				method: 'PATCH',
				body,
			}),
			invalidatesTags: (_result, _error, { id }) => [{ type: 'ItemRequests', id }, 'ItemRequests'],
		}),

		// Ignore an item request
		ignoreItemRequest: builder.mutation<unknown, string>({
			query: id => ({
				url: `/item-requests/${id}/action`,
				method: 'POST',
				body: { action: 'IGNORED' },
			}),
			invalidatesTags: ['ItemRequests'],
		}),

		// Un-ignore an item request
		unignoreItemRequest: builder.mutation<unknown, string>({
			query: id => ({
				url: `/item-requests/${id}/action?action=IGNORED`,
				method: 'DELETE',
			}),
			invalidatesTags: ['ItemRequests'],
		}),

		// Mark item request as responded
		respondToItemRequest: builder.mutation<unknown, string>({
			query: id => ({
				url: `/item-requests/${id}/action`,
				method: 'POST',
				body: { action: 'RESPONDED' },
			}),
			invalidatesTags: ['ItemRequests'],
		}),

		// ===== Borrow Requests =====

		// Get borrow requests
		getBorrowRequests: builder.query<BorrowRequest[], GetBorrowRequestsFilters | void>({
			query: (filters = {}) => {
				const params = new URLSearchParams();
				if (filters && typeof filters === 'object') {
					const { type, status, itemId } = filters;
					if (type) params.append('type', type);
					if (status) params.append('status', status);
					if (itemId) params.append('itemId', itemId);
				}
				const queryString = params.toString();
				return `/borrow-requests${queryString ? `?${queryString}` : ''}`;
			},
			providesTags: ['BorrowRequests'],
		}),

		// Get single borrow request
		getBorrowRequest: builder.query<BorrowRequest, string>({
			query: id => `/borrow-requests/${id}`,
			providesTags: (_result, _error, id) => [{ type: 'BorrowRequests', id }],
		}),

		// Create borrow request (or join queue)
		createBorrowRequest: builder.mutation<
			{ type: 'request' | 'queue'; borrowRequest?: BorrowRequest; queueEntry?: BorrowQueueEntry },
			CreateBorrowRequestInput
		>({
			query: body => ({
				url: '/borrow-requests',
				method: 'POST',
				body,
			}),
			// Also invalidate Items to update availability status
			invalidatesTags: (_result, _error, { itemId }) => [
				'BorrowRequests',
				'BorrowQueue',
				{ type: 'Items' as const, id: itemId },
			],
		}),

		// Approve/decline/cancel borrow request
		updateBorrowRequest: builder.mutation<BorrowRequest, BorrowRequestActionInput>({
			query: ({ id, ...body }) => ({
				url: `/borrow-requests/${id}`,
				method: 'PATCH',
				body,
			}),
			// Also invalidate Items to update availability when request is approved/declined
			invalidatesTags: (result, _error, { id }) => [
				{ type: 'BorrowRequests', id },
				'BorrowRequests',
				'Transactions',
				// Invalidate the specific item if available (skip on error -- nothing changed)
				...(result?.item?.id ? [{ type: 'Items' as const, id: result.item.id }] : []),
			],
		}),

		// Mark item as returned (borrower)
		markAsReturned: builder.mutation<{ message: string; transaction: BorrowTransaction }, { id: string; returnNote?: string }>({
			query: ({ id, ...body }) => ({
				url: `/borrow-requests/${id}/return`,
				method: 'POST',
				body,
			}),
			invalidatesTags: ['BorrowRequests', 'Transactions'],
		}),

		// Confirm return (owner)
		confirmReturn: builder.mutation<{ message: string; transaction: BorrowTransaction }, string>({
			query: id => ({
				url: `/borrow-requests/${id}/confirm-return`,
				method: 'POST',
			}),
			invalidatesTags: ['BorrowRequests', 'Transactions', 'BorrowQueue'],
		}),

		// Confirm handoff (lender confirms giving the item)
		confirmHandoff: builder.mutation<{ message: string; transaction: BorrowTransaction }, string>({
			query: id => ({
				url: `/borrow-requests/${id}/handoff`,
				method: 'POST',
			}),
			invalidatesTags: ['BorrowRequests', 'Transactions'],
		}),

		// Confirm receipt (borrower confirms receiving the item)
		confirmReceipt: builder.mutation<{ message: string; transaction: BorrowTransaction }, string>({
			query: id => ({
				url: `/borrow-requests/${id}/receive`,
				method: 'POST',
			}),
			invalidatesTags: ['BorrowRequests', 'Transactions'],
		}),

		// Extend borrow period (borrower requests new due date)
		extendBorrow: builder.mutation<{ message: string; transaction: BorrowTransaction }, { id: string; newDueAt: string }>({
			query: ({ id, newDueAt }) => ({
				url: `/borrow-requests/${id}/extend`,
				method: 'POST',
				body: { newDueAt },
			}),
			invalidatesTags: ['Transactions'],
		}),

		// ===== Borrow Queue =====

		// Get queue entries
		getQueueEntries: builder.query<BorrowQueueEntry[], { itemId?: string; myEntries?: boolean } | void>({
			query: (filters = {}) => {
				const params = new URLSearchParams();
				if (filters && typeof filters === 'object') {
					const { itemId, myEntries } = filters;
					if (itemId) params.append('itemId', itemId);
					if (myEntries) params.append('myEntries', 'true');
				}
				const queryString = params.toString();
				return `/borrow-queue${queryString ? `?${queryString}` : ''}`;
			},
			providesTags: ['BorrowQueue'],
		}),

		// Leave queue / remove from queue
		leaveQueue: builder.mutation<{ message: string }, string>({
			query: id => ({
				url: `/borrow-queue/${id}`,
				method: 'DELETE',
			}),
			invalidatesTags: ['BorrowQueue'],
		}),

		// Convert queue entry to borrow request
		convertQueueEntry: builder.mutation<{ message: string; borrowRequest: BorrowRequest }, string>({
			query: id => ({
				url: `/borrow-queue/${id}`,
				method: 'POST',
			}),
			invalidatesTags: ['BorrowQueue', 'BorrowRequests'],
		}),

		// ===== Transactions =====

		// Get transactions
		getTransactions: builder.query<FullTransaction[], GetTransactionsFilters | void>({
			query: (filters = {}) => {
				const params = new URLSearchParams();
				if (filters && typeof filters === 'object') {
					const { role, status, itemId } = filters;
					if (role) params.append('role', role);
					if (status) params.append('status', status);
					if (itemId) params.append('itemId', itemId);
				}
				const queryString = params.toString();
				return `/transactions${queryString ? `?${queryString}` : ''}`;
			},
			providesTags: ['Transactions'],
		}),
	}),
});

export const {
	// Item Requests
	useGetItemRequestsQuery,
	useGetItemRequestQuery,
	useCreateItemRequestMutation,
	useUpdateItemRequestMutation,
	useIgnoreItemRequestMutation,
	useUnignoreItemRequestMutation,
	useRespondToItemRequestMutation,
	// Borrow Requests
	useGetBorrowRequestsQuery,
	useGetBorrowRequestQuery,
	useCreateBorrowRequestMutation,
	useUpdateBorrowRequestMutation,
	useMarkAsReturnedMutation,
	useConfirmReturnMutation,
	useConfirmHandoffMutation,
	useConfirmReceiptMutation,
	useExtendBorrowMutation,
	// Queue
	useGetQueueEntriesQuery,
	useLeaveQueueMutation,
	useConvertQueueEntryMutation,
	// Transactions
	useGetTransactionsQuery,
} = borrowApi;
