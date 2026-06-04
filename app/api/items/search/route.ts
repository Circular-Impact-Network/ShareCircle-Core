import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getUserCircleIds } from '@/app/api/_utils';
import { Prisma } from '@prisma/client';
import { getSignedUrl } from '@/lib/supabase';
import { generateTextEmbedding, generateImageEmbedding, generateDocumentEmbedding } from '@/lib/ai';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

export const maxDuration = 60;

interface SearchResult {
	id: string;
	name: string;
	description: string | null;
	image_path: string;
	categories: string[];
	tags: string[];
	owner_id: string;
	created_at: Date;
	similarity: number;
}

interface SearchRequestBody {
	query?: string;
	imageUrl?: string;
	category?: string;
	tag?: string;
	circleIds?: string[];
	limit?: number;
	threshold?: number;
}

// POST /api/items/search - Vector similarity search
export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;

		const identifier = getClientIdentifier(req, userId);
		const rateLimitResult = checkRateLimit(identifier, 'items-search', RATE_LIMITS.ai);
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const body: SearchRequestBody = await req.json();
		const {
			query,
			imageUrl,
			category,
			tag,
			circleIds,
			limit = 20,
			threshold = 0.2, // Multimodal embeddings produce higher similarity scores for relevant matches
		} = body;

		// Need at least query or imageUrl
		if (!query && !imageUrl) {
			return NextResponse.json({ error: 'Query text or image URL is required' }, { status: 400 });
		}

		// Validate query is not too short
		if (query && query.trim().length < 2) {
			return NextResponse.json({ error: 'Search query is too short' }, { status: 400 });
		}

		// Get user's circles if not specified
		let searchCircleIds = circleIds;
		if (!searchCircleIds || searchCircleIds.length === 0) {
			searchCircleIds = await getUserCircleIds(userId);
		} else {
			// Verify user is a member of specified circles
			const userCircles = await prisma.circleMember.findMany({
				where: {
					userId,
					circleId: { in: circleIds },
					leftAt: null,
				},
				select: {
					circleId: true,
				},
			});
			searchCircleIds = userCircles.map(m => m.circleId);
		}

		if (searchCircleIds.length === 0) {
			return NextResponse.json([], { status: 200 });
		}

		// Prepare category and tag filters (null if not specified or "All Categories")
		const categoryFilter = category && category !== 'All Categories' ? category : null;
		const tagFilter = tag || null;
		const queryText = query?.trim() || null;

		// 1) Vector / hybrid search (best-effort). Embedding generation or the SQL
		//    function can fail (quota, NULL embeddings on freshly-created items, etc.) —
		//    we never let that abort the request; the text fallback below covers it.
		let vectorResults: SearchResult[] = [];
		try {
			let embedding: number[] | null = null;
			if (imageUrl && query) {
				embedding = await generateDocumentEmbedding(imageUrl, query);
			} else if (imageUrl) {
				embedding = await generateImageEmbedding(imageUrl);
			} else if (queryText) {
				embedding = await generateTextEmbedding(queryText);
			}
			if (embedding) {
				const embeddingVector = Prisma.raw(`'[${embedding.join(',')}]'::vector`);
				vectorResults = await prisma.$queryRaw<SearchResult[]>`
					SELECT * FROM search_items(
						${embeddingVector},
						${queryText},
						${searchCircleIds}::text[],
						${categoryFilter},
						${tagFilter},
						${threshold}::float,
						${limit}::int
					)
				`;
			}
		} catch (vectorError) {
			console.error('Vector search failed; falling back to text search:', vectorError);
		}

		// 2) Text-search fallback/supplement. Guarantees plain name/description matches
		//    surface even when an item has no embedding yet (embeddings are generated
		//    asynchronously after create) or when the vector path failed. Scoped to the
		//    user's circles, with the same category/tag filters.
		let textResults: SearchResult[] = [];
		if (queryText) {
			try {
				const rows = await prisma.item.findMany({
					where: {
						archivedAt: null,
						circles: { some: { circleId: { in: searchCircleIds } } },
						...(categoryFilter ? { categories: { has: categoryFilter } } : {}),
						...(tagFilter ? { tags: { has: tagFilter } } : {}),
						OR: [
							{ name: { contains: queryText, mode: 'insensitive' } },
							{ description: { contains: queryText, mode: 'insensitive' } },
						],
					},
					select: {
						id: true,
						name: true,
						description: true,
						imagePath: true,
						categories: true,
						tags: true,
						ownerId: true,
						createdAt: true,
					},
					orderBy: { createdAt: 'desc' },
					take: limit,
				});
				textResults = rows.map(r => ({
					id: r.id,
					name: r.name,
					description: r.description,
					image_path: r.imagePath,
					categories: r.categories,
					tags: r.tags,
					owner_id: r.ownerId,
					created_at: r.createdAt,
					similarity: 0.5,
				}));
			} catch (textError) {
				console.error('Text search failed:', textError);
			}
		}

		// Merge: vector matches first (ranked), then any text matches not already present.
		const seenIds = new Set<string>();
		const results: SearchResult[] = [];
		for (const row of [...vectorResults, ...textResults]) {
			if (seenIds.has(row.id)) continue;
			seenIds.add(row.id);
			results.push(row);
			if (results.length >= limit) break;
		}

		// If no results, return empty array early
		if (results.length === 0) {
			return NextResponse.json([], { status: 200 });
		}

		const visibleItems = await prisma.item.findMany({
			where: {
				id: { in: results.map(result => result.id) },
				archivedAt: null,
			},
			select: {
				id: true,
				isAvailable: true,
			},
		});
		const visibleItemMap = new Map(visibleItems.map(item => [item.id, item]));

		if (visibleItemMap.size === 0) {
			return NextResponse.json([], { status: 200 });
		}

		// Get owner info and generate signed URLs
		const filteredResults = results.filter(result => visibleItemMap.has(result.id));
		const ownerIds = [...new Set(filteredResults.map(r => r.owner_id))];
		const owners = await prisma.user.findMany({
			where: {
				id: { in: ownerIds },
			},
			select: {
				id: true,
				name: true,
				image: true,
			},
		});

		const ownerMap = new Map(owners.map(o => [o.id, o]));

		const itemsWithUrls = await Promise.all(
			filteredResults.map(async item => {
				const imageUrlSigned = await getSignedUrl(item.image_path, 'items');
				const visibleItem = visibleItemMap.get(item.id);
				return {
					id: item.id,
					name: item.name,
					description: item.description,
					imageUrl: imageUrlSigned,
					imagePath: item.image_path,
					categories: item.categories,
					tags: item.tags,
					createdAt: item.created_at,
					similarity: item.similarity,
					owner: ownerMap.get(item.owner_id) || { id: item.owner_id, name: null, image: null },
					circles: [], // Search results don't include circle info for performance
					isOwner: item.owner_id === userId,
					isAvailable: visibleItem?.isAvailable ?? true,
					archivedAt: null,
				};
			}),
		);

		return NextResponse.json(itemsWithUrls, { status: 200 });
	} catch (error) {
		console.error('Search items error:', error);
		// Return empty results for graceful degradation instead of showing error to user
		return NextResponse.json([], { status: 200 });
	}
}
