import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getSignedUrl } from '@/lib/supabase';
import { generateImageEmbedding } from '@/lib/ai';

/**
 * Fire-and-forget function to generate and store embedding for an item.
 * This runs asynchronously after the item is created to avoid blocking.
 */
async function generateAndStoreEmbedding(itemId: string, imageUrl: string): Promise<void> {
	try {
		const embedding = await generateImageEmbedding(imageUrl);
		// Format embedding as PostgreSQL vector literal using Prisma.raw
		const embeddingVector = Prisma.raw(`'[${embedding.join(',')}]'::vector`);
		await prisma.$executeRaw`
			UPDATE items SET embedding = ${embeddingVector}
			WHERE id = ${itemId}
		`;
		console.log(`Successfully generated embedding for item ${itemId}, dimensions: ${embedding.length}`);
	} catch (error) {
		console.error(`Failed to generate embedding for item ${itemId}:`, error);
		// Don't throw - this is fire-and-forget
	}
}

// GET /api/items - Get items for a circle (or all user's circles)
export async function GET(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const circleId = req.nextUrl.searchParams.get('circleId');
		const category = req.nextUrl.searchParams.get('category');
		const tag = req.nextUrl.searchParams.get('tag');

		// Get circles the user is a member of
		const userCircles = await prisma.circleMember.findMany({
			where: {
				userId,
				leftAt: null,
			},
			select: {
				circleId: true,
			},
		});

		const userCircleIds = userCircles.map(m => m.circleId);

		// If circleId is specified, verify user is a member
		if (circleId && !userCircleIds.includes(circleId)) {
			return NextResponse.json({ error: 'You are not a member of this circle' }, { status: 403 });
		}

		// Build where clause with optional category/tag filtering
		const whereClause: {
			circles: { some: { circleId: string | { in: string[] } } };
			categories?: { has: string };
			tags?: { has: string };
		} = {
			circles: {
				some: {
					circleId: circleId || { in: userCircleIds },
				},
			},
		};

		// Add category filter if provided and not "All Categories"
		if (category && category !== 'All Categories') {
			whereClause.categories = { has: category };
		}

		// Add tag filter if provided
		if (tag) {
			whereClause.tags = { has: tag };
		}

		// Get items in the specified circle(s) with filters
		const items = await prisma.item.findMany({
			where: whereClause,
			include: {
				owner: {
					select: {
						id: true,
						name: true,
						image: true,
					},
				},
				circles: {
					select: {
						circleId: true,
						circle: {
							select: {
								id: true,
								name: true,
							},
						},
					},
				},
			},
			orderBy: {
				createdAt: 'desc',
			},
		});

		// Generate signed URLs for item images
		const itemsWithUrls = await Promise.all(
			items.map(async item => {
				const imageUrl = await getSignedUrl(item.imagePath, 'items');
				return {
					id: item.id,
					name: item.name,
					description: item.description,
					imageUrl,
					imagePath: item.imagePath,
					categories: item.categories,
					tags: item.tags,
					createdAt: item.createdAt,
					updatedAt: item.updatedAt,
					owner: item.owner,
					circles: item.circles.map(c => ({
						id: c.circle.id,
						name: c.circle.name,
					})),
					isOwner: item.ownerId === userId,
				};
			}),
		);

		return NextResponse.json(itemsWithUrls, { status: 200 });
	} catch (error) {
		console.error('Get items error:', error);
		return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
	}
}

// POST /api/items - Create a new item
export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const body = await req.json();
		const { name, description, imagePath, imageUrl, categories, tags, circleIds } = body;

		// Validate required fields
		if (!name || typeof name !== 'string' || name.trim().length === 0) {
			return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
		}

		if (!imagePath || typeof imagePath !== 'string') {
			return NextResponse.json({ error: 'Image path is required' }, { status: 400 });
		}

		if (!circleIds || !Array.isArray(circleIds) || circleIds.length === 0) {
			return NextResponse.json({ error: 'At least one circle must be selected' }, { status: 400 });
		}

		// Verify user is a member of all specified circles
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

		const validCircleIds = userCircles.map(m => m.circleId);
		const invalidCircles = circleIds.filter((id: string) => !validCircleIds.includes(id));

		if (invalidCircles.length > 0) {
			return NextResponse.json({ error: 'You are not a member of some selected circles' }, { status: 403 });
		}

		// Create item with circle associations in a transaction (NO BLOCKING EMBEDDING)
		const item = await prisma.$transaction(async tx => {
			const newItem = await tx.item.create({
				data: {
					name: name.trim(),
					description: description?.trim() || null,
					imagePath,
					categories: categories || [],
					tags: tags || [],
					ownerId: userId,
				},
				include: {
					owner: {
						select: {
							id: true,
							name: true,
							image: true,
						},
					},
				},
			});

			// Create circle associations
			await tx.itemCircle.createMany({
				data: validCircleIds.map(circleId => ({
					itemId: newItem.id,
					circleId,
				})),
			});

			return newItem;
		});

		// Generate signed URL for the response
		const signedImageUrl = await getSignedUrl(item.imagePath, 'items');

		// Fire-and-forget: Generate embedding in the background (NON-BLOCKING)
		// This allows the response to return immediately while embedding is generated
		if (imageUrl) {
			generateAndStoreEmbedding(item.id, imageUrl).catch(err =>
				console.error('Background embedding generation failed:', err)
			);
		}

		return NextResponse.json(
			{
				id: item.id,
				name: item.name,
				description: item.description,
				imageUrl: signedImageUrl,
				imagePath: item.imagePath,
				categories: item.categories,
				tags: item.tags,
				createdAt: item.createdAt,
				owner: item.owner,
				circles: validCircleIds,
				isOwner: true,
			},
			{ status: 201 },
		);
	} catch (error) {
		console.error('Create item error:', error);
		return NextResponse.json({ error: 'Failed to create item' }, { status: 500 });
	}
}


