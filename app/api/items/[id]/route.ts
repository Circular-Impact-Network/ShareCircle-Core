import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSignedUrl, deleteImage } from '@/lib/supabase';
import { generateImageEmbedding } from '@/lib/ai';

// GET /api/items/[id] - Get a single item
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;

		// Get user's circles
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

		// Get the item if it's in any of user's circles
		const item = await prisma.item.findFirst({
			where: {
				id,
				circles: {
					some: {
						circleId: { in: userCircleIds },
					},
				},
			},
			include: {
				owner: {
					select: {
						id: true,
						name: true,
						image: true,
						email: true,
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
		});

		if (!item) {
			return NextResponse.json({ error: 'Item not found or not accessible' }, { status: 404 });
		}

		// Generate signed URL
		const imageUrl = await getSignedUrl(item.imagePath, 'items');

		return NextResponse.json(
			{
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
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Get item error:', error);
		return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 });
	}
}

// PATCH /api/items/[id] - Update an item
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;
		const body = await req.json();
		const { name, description, imagePath, imageUrl, categories, tags, circleIds } = body;

		// Verify ownership
		const item = await prisma.item.findUnique({
			where: { id },
			select: { ownerId: true, imagePath: true },
		});

		if (!item) {
			return NextResponse.json({ error: 'Item not found' }, { status: 404 });
		}

		if (item.ownerId !== userId) {
			return NextResponse.json({ error: 'You can only edit your own items' }, { status: 403 });
		}

		// If circleIds are provided, verify user is a member of all
		let validCircleIds: string[] | undefined;
		if (circleIds && Array.isArray(circleIds)) {
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

			validCircleIds = userCircles.map(m => m.circleId);
			const invalidCircles = circleIds.filter((cid: string) => !validCircleIds!.includes(cid));

			if (invalidCircles.length > 0) {
				return NextResponse.json({ error: 'You are not a member of some selected circles' }, { status: 403 });
			}
		}

		// If image changed, generate new embedding
		let embedding: number[] | null = null;
		const imageChanged = imagePath && imagePath !== item.imagePath;
		if (imageChanged && imageUrl) {
			try {
				embedding = await generateImageEmbedding(imageUrl);
			} catch (embeddingError) {
				console.error('Failed to generate embedding:', embeddingError);
			}
		}

		// Update item in transaction
		const updatedItem = await prisma.$transaction(async tx => {
			// Update the item
			const updated = await tx.item.update({
				where: { id },
				data: {
					...(name !== undefined && { name: name.trim() }),
					...(description !== undefined && { description: description?.trim() || null }),
					...(imagePath !== undefined && { imagePath }),
					...(categories !== undefined && { categories }),
					...(tags !== undefined && { tags }),
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

			// Update circle associations if provided
			if (validCircleIds) {
				// Delete existing associations
				await tx.itemCircle.deleteMany({
					where: { itemId: id },
				});

				// Create new associations
				await tx.itemCircle.createMany({
					data: validCircleIds.map(circleId => ({
						itemId: id,
						circleId,
					})),
				});
			}

			return updated;
		});

		// Update embedding if we have a new one
		if (embedding) {
			await prisma.$executeRaw`
				UPDATE items SET embedding = ${embedding}::vector 
				WHERE id = ${id}
			`;
		}

		// Delete old image if it changed
		if (imageChanged && item.imagePath) {
			try {
				await deleteImage(item.imagePath, 'items');
			} catch (deleteError) {
				console.error('Failed to delete old image:', deleteError);
			}
		}

		// Generate signed URL
		const signedImageUrl = await getSignedUrl(updatedItem.imagePath, 'items');

		return NextResponse.json(
			{
				id: updatedItem.id,
				name: updatedItem.name,
				description: updatedItem.description,
				imageUrl: signedImageUrl,
				imagePath: updatedItem.imagePath,
				categories: updatedItem.categories,
				tags: updatedItem.tags,
				createdAt: updatedItem.createdAt,
				updatedAt: updatedItem.updatedAt,
				owner: updatedItem.owner,
				isOwner: true,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Update item error:', error);
		return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
	}
}

// DELETE /api/items/[id] - Delete an item
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;

		// Verify ownership
		const item = await prisma.item.findUnique({
			where: { id },
			select: { ownerId: true, imagePath: true },
		});

		if (!item) {
			return NextResponse.json({ error: 'Item not found' }, { status: 404 });
		}

		if (item.ownerId !== userId) {
			return NextResponse.json({ error: 'You can only delete your own items' }, { status: 403 });
		}

		// Delete item (cascade will handle circle associations)
		await prisma.item.delete({
			where: { id },
		});

		// Delete the image from storage
		try {
			await deleteImage(item.imagePath, 'items');
		} catch (deleteError) {
			console.error('Failed to delete image:', deleteError);
			// Item is already deleted from DB, so don't fail the request
		}

		return NextResponse.json({ message: 'Item deleted successfully' }, { status: 200 });
	} catch (error) {
		console.error('Delete item error:', error);
		return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
	}
}


