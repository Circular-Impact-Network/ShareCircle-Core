import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSignedUrl } from '@/lib/supabase';
import { generateTextEmbedding, generateImageEmbedding, generateMultimodalEmbedding } from '@/lib/ai';

interface SearchResult {
	id: string;
	name: string;
	description: string | null;
	image_path: string;
	categories: string[];
	tags: string[];
	owner_id: string;
	similarity: number;
}

// POST /api/items/search - Vector similarity search
export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const body = await req.json();
		const { query, imageUrl, circleIds, limit = 20, threshold = 0.3 } = body;

		// Need at least query or imageUrl
		if (!query && !imageUrl) {
			return NextResponse.json({ error: 'Query text or image URL is required' }, { status: 400 });
		}

		// Get user's circles if not specified
		let searchCircleIds = circleIds;
		if (!searchCircleIds || searchCircleIds.length === 0) {
			const userCircles = await prisma.circleMember.findMany({
				where: {
					userId,
					leftAt: null,
				},
				select: {
					circleId: true,
				},
			});
			searchCircleIds = userCircles.map(m => m.circleId);
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

		// Generate embedding based on search type
		let embedding: number[];
		try {
			if (imageUrl && query) {
				// Combined search: image + text refinement
				embedding = await generateMultimodalEmbedding(imageUrl, query);
			} else if (imageUrl) {
				// Image-only search
				embedding = await generateImageEmbedding(imageUrl);
			} else {
				// Text-only search
				embedding = await generateTextEmbedding(query);
			}
		} catch (embeddingError) {
			console.error('Failed to generate search embedding:', embeddingError);
			return NextResponse.json({ error: 'Failed to process search query' }, { status: 500 });
		}

		// Perform vector similarity search using the SQL function
		const results = await prisma.$queryRaw<SearchResult[]>`
			SELECT * FROM search_items(
				${embedding}::vector,
				${searchCircleIds}::text[],
				${threshold}::float,
				${limit}::int
			)
		`;

		// Get owner info and generate signed URLs
		const ownerIds = [...new Set(results.map(r => r.owner_id))];
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
			results.map(async item => {
				const imageUrlSigned = await getSignedUrl(item.image_path, 'items');
				return {
					id: item.id,
					name: item.name,
					description: item.description,
					imageUrl: imageUrlSigned,
					imagePath: item.image_path,
					categories: item.categories,
					tags: item.tags,
					similarity: item.similarity,
					owner: ownerMap.get(item.owner_id) || { id: item.owner_id, name: null, image: null },
					isOwner: item.owner_id === userId,
				};
			}),
		);

		return NextResponse.json(itemsWithUrls, { status: 200 });
	} catch (error) {
		console.error('Search items error:', error);
		return NextResponse.json({ error: 'Failed to search items' }, { status: 500 });
	}
}


