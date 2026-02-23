import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Types (Item includes mediaPaths and mediaUrls for carousel)
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
	mediaUrls?: string[];
	mediaPaths?: string[];
	categories: string[];
	tags: string[];
	createdAt: string;
	updatedAt?: string;
	archivedAt?: string | null;
	owner: ItemOwner;
	circles: ItemCircle[];
	isOwner: boolean;
	isAvailable?: boolean;
	similarity?: number;
}

export interface ItemAnalysis {
	name: string;
	description: string;
	categories: string[];
	tags: string[];
}

export interface DetectedItem {
	name: string;
	description?: string;
	category: string;
	confidence?: 'high' | 'medium' | 'low';
}

export interface ItemDetection {
	items: DetectedItem[];
}

export interface AnalyzeImageRequest {
	imageUrl: string;
	selectedItem?: string;
	userHint?: string;
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
	mediaPaths?: string[];
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
	mediaPaths?: string[];
	categories?: string[];
	tags?: string[];
	circleIds?: string[];
	archived?: boolean;
}

export interface GetItemsFilters {
	category?: string;
	tag?: string;
	circleId?: string;
	includeArchived?: boolean;
	archived?: boolean;
	ownerOnly?: boolean;
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

		// Upload supporting media (images/videos)
		uploadMedia: builder.mutation<UploadImageResponse, File>({
			query: file => {
				const formData = new FormData();
				formData.append('file', file);
				return {
					url: '/upload/image?bucket=media',
					method: 'POST',
					body: formData,
				};
			},
		}),

		// Detect items in image (Option 2 flow)
		detectItems: builder.mutation<ItemDetection, string>({
			query: imageUrl => ({
				url: '/items/detect',
				method: 'POST',
				body: { imageUrl },
			}),
		}),

		// Analyze image with AI
		analyzeImage: builder.mutation<ItemAnalysis, AnalyzeImageRequest>({
			query: ({ imageUrl, selectedItem, userHint }) => ({
				url: '/items/analyze',
				method: 'POST',
				body: {
					imageUrl,
					...(selectedItem && { selectedItem }),
					...(userHint && { userHint }),
				},
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
					const { category, tag, circleId, includeArchived, archived, ownerOnly } = filters;
					if (category && category !== 'All Categories') {
						params.append('category', category);
					}
					if (tag) {
						params.append('tag', tag);
					}
					if (circleId) {
						params.append('circleId', circleId);
					}
					if (includeArchived) {
						params.append('includeArchived', 'true');
					}
					if (archived !== undefined) {
						params.append('archived', String(archived));
					}
					if (ownerOnly) {
						params.append('ownerOnly', 'true');
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
			// Invalidate the specific item and all lists
			// Note: We can't know which circle IDs to invalidate without the item data,
			// so we invalidate all CircleItems. This is acceptable for delete operations.
			invalidatesTags: (_result, _error, id) => [
				{ type: 'Items', id },
				'Items',
				'CircleItems',
			],
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
	useUploadMediaMutation,
	useAnalyzeImageMutation,
	useDetectItemsMutation,
	useGetCircleItemsQuery,
	useGetAllItemsQuery,
	useGetItemQuery,
	useCreateItemMutation,
	useUpdateItemMutation,
	useDeleteItemMutation,
	useSearchItemsMutation,
	useCleanupImageMutation,
} = itemsApi;
