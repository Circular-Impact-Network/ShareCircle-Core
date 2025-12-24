import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSignedUrl } from '@/lib/supabase';
import { generateImageEmbedding } from '@/lib/ai';

// GET /api/items - Get items for a circle (or all user's circles)
export async function GET(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const circleId = req.nextUrl.searchParams.get('circleId');

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

		// Get items in the specified circle(s)
		const items = await prisma.item.findMany({
			where: {
				circles: {
					some: {
						circleId: circleId || { in: userCircleIds },
					},
				},
			},
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

		// Generate embedding for the image (for vector search)
		let embedding: number[] | null = null;
		if (imageUrl) {
			try {
				embedding = await generateImageEmbedding(imageUrl);
			} catch (embeddingError) {
				console.error('Failed to generate embedding:', embeddingError);
				// Continue without embedding - search will fall back to text matching
			}
		}

		// Create item with circle associations in a transaction
		const item = await prisma.$transaction(async tx => {
			// Create the item (without embedding - we'll add that via raw SQL)
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

		// Store embedding if we have one (using raw SQL for vector type)
		if (embedding) {
			await prisma.$executeRaw`
				UPDATE items SET embedding = ${embedding}::vector 
				WHERE id = ${item.id}
			`;
		}

		// Generate signed URL for the response
		const signedImageUrl = await getSignedUrl(item.imagePath, 'items');

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


