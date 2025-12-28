import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Types
export interface ItemOwner {
	id: string;
	name: string | null;
	image: string | null;
}

export interface ItemCircle {
	id: string;
	name: string;
}

export interface Item {
	id: string;
	name: string;
	description: string | null;
	imageUrl: string;
	imagePath: string;
	categories: string[];
	tags: string[];
	createdAt: string;
	updatedAt?: string;
	owner: ItemOwner;
	circles: ItemCircle[];
	isOwner: boolean;
	similarity?: number;
}

export interface ItemAnalysis {
	name: string;
	description: string;
	categories: string[];
	tags: string[];
}

export interface UploadImageResponse {
	path: string;
	url: string;
}

export interface CreateItemRequest {
	name: string;
	description?: string;
	imagePath: string;
	imageUrl: string;
	categories: string[];
	tags: string[];
	circleIds: string[];
}

export interface UpdateItemRequest {
	id: string;
	name?: string;
	description?: string;
	imagePath?: string;
	imageUrl?: string;
	categories?: string[];
	tags?: string[];
	circleIds?: string[];
}

export interface GetItemsFilters {
	category?: string;
	tag?: string;
	circleId?: string;
}

export interface SearchItemsRequest {
	query?: string;
	imageUrl?: string;
	category?: string;
	tag?: string;
	circleIds?: string[];
	limit?: number;
	threshold?: number;
}

export const itemsApi = createApi({
	reducerPath: 'itemsApi',
	baseQuery: fetchBaseQuery({
		baseUrl: '/api',
		credentials: 'include',
	}),
	tagTypes: ['Items', 'CircleItems'],
	endpoints: builder => ({
		// Upload item image
		uploadItemImage: builder.mutation<UploadImageResponse, File>({
			query: file => {
				const formData = new FormData();
				formData.append('file', file);
				return {
					url: '/upload/image?bucket=items',
					method: 'POST',
					body: formData,
				};
			},
		}),

		// Analyze image with AI
		analyzeImage: builder.mutation<ItemAnalysis, string>({
			query: imageUrl => ({
				url: '/items/analyze',
				method: 'POST',
				body: { imageUrl },
			}),
		}),

		// Get items for a circle
		getCircleItems: builder.query<Item[], string>({
			query: circleId => `/items?circleId=${circleId}`,
			providesTags: (_result, _error, circleId) => [{ type: 'CircleItems', id: circleId }],
		}),

		// Get all items across user's circles with optional filters
		getAllItems: builder.query<Item[], GetItemsFilters | void>({
			query: (filters = {}) => {
				const params = new URLSearchParams();
				if (filters && typeof filters === 'object') {
					const { category, tag, circleId } = filters;
					if (category && category !== 'All Categories') {
						params.append('category', category);
					}
					if (tag) {
						params.append('tag', tag);
					}
					if (circleId) {
						params.append('circleId', circleId);
					}
				}
				const queryString = params.toString();
				return `/items${queryString ? `?${queryString}` : ''}`;
			},
			providesTags: ['Items'],
		}),

		// Get a single item
		getItem: builder.query<Item, string>({
			query: id => `/items/${id}`,
			providesTags: (_result, _error, id) => [{ type: 'Items', id }],
		}),

		// Create a new item
		createItem: builder.mutation<Item, CreateItemRequest>({
			query: body => ({
				url: '/items',
				method: 'POST',
				body,
			}),
			invalidatesTags: (_result, _error, { circleIds }) => [
				'Items',
				...circleIds.map(id => ({ type: 'CircleItems' as const, id })),
			],
		}),

		// Update an item
		updateItem: builder.mutation<Item, UpdateItemRequest>({
			query: ({ id, ...body }) => ({
				url: `/items/${id}`,
				method: 'PATCH',
				body,
			}),
			invalidatesTags: (_result, _error, { id, circleIds }) => [
				{ type: 'Items', id },
				'Items',
				...(circleIds?.map(cid => ({ type: 'CircleItems' as const, id: cid })) || []),
			],
		}),

		// Delete an item
		deleteItem: builder.mutation<{ message: string }, string>({
			query: id => ({
				url: `/items/${id}`,
				method: 'DELETE',
			}),
			invalidatesTags: ['Items', 'CircleItems'],
		}),

		// Search items with vector similarity
		searchItems: builder.mutation<Item[], SearchItemsRequest>({
			query: body => ({
				url: '/items/search',
				method: 'POST',
				body,
			}),
		}),

		// Cleanup orphaned image (for cancellation)
		cleanupImage: builder.mutation<{ message: string }, string>({
			query: imagePath => ({
				url: '/items/cleanup',
				method: 'DELETE',
				body: { imagePath },
			}),
		}),
	}),
});

export const {
	useUploadItemImageMutation,
	useAnalyzeImageMutation,
	useGetCircleItemsQuery,
	useGetAllItemsQuery,
	useGetItemQuery,
	useCreateItemMutation,
	useUpdateItemMutation,
	useDeleteItemMutation,
	useSearchItemsMutation,
	useCleanupImageMutation,
} = itemsApi;
