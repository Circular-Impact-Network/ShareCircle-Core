import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma, BorrowTransactionStatus } from '@prisma/client';
import { getSignedUrl, deleteImage } from '@/lib/supabase';
import { generateDocumentEmbedding, buildEnrichedText, validateListingAgainstImages } from '@/lib/ai';

// GET/PATCH/DELETE with multi-circle and media paths

// GET /api/items/[id] - Get a single item
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id } = await params;
		const userId = session.user.id;

		// First check if the item exists at all
		const itemExists = await prisma.item.findUnique({
			where: { id },
			select: { id: true },
		});

		if (!itemExists) {
			return NextResponse.json({ error: 'Item not found' }, { status: 404 });
		}

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
				borrowTransactions: {
					where: {
						status: { in: ['ACTIVE', 'LENDER_CONFIRMED', 'BORROWER_CONFIRMED', 'RETURN_PENDING'] },
					},
					orderBy: { createdAt: 'desc' },
					take: 1,
					select: { dueAt: true },
				},
			},
		});

		if (!item) {
			// Item exists but user doesn't have access (not a member of any circle the item is in)
			return NextResponse.json(
				{
					error: 'Access denied',
					message: 'You are not a member of the circle(s) this item belongs to',
				},
				{ status: 403 },
			);
		}

		if (item.archivedAt && item.ownerId !== userId) {
			return NextResponse.json({ error: 'Item not found' }, { status: 404 });
		}

		// Generate signed URL for main image
		let imageUrl = '';
		try {
			imageUrl = await getSignedUrl(item.imagePath, 'items');
		} catch (err) {
			console.error(`Failed to get signed URL for item ${item.id}:`, err);
		}

		// Generate signed URLs for all media files (main image + supporting media)
		const mediaUrls = await Promise.all([
			imageUrl, // Main image is first
			...(item.mediaPaths || []).map(path =>
				getSignedUrl(path, 'media').catch(err => {
					console.error(`Failed to get signed URL for media of item ${item.id}:`, err);
					return '';
				}),
			),
		]);

		return NextResponse.json(
			{
				id: item.id,
				name: item.name,
				description: item.description,
				imageUrl,
				imagePath: item.imagePath,
				mediaUrls,
				mediaPaths: item.mediaPaths,
				categories: item.categories,
				tags: item.tags,
				createdAt: item.createdAt,
				updatedAt: item.updatedAt,
				archivedAt: item.archivedAt,
				owner: item.owner,
				// Only show circles the user is a member of (not all circles the item is shared in)
				circles: item.circles
					.filter(c => userCircleIds.includes(c.circleId))
					.map(c => ({
						id: c.circle.id,
						name: c.circle.name,
					})),
				isOwner: item.ownerId === userId,
				isAvailable: item.isAvailable,
				borrowedUntil: item.borrowTransactions[0]?.dueAt ?? null,
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
		const { name, description, imagePath, imageUrl, categories, tags, circleIds, mediaPaths, archived } = body;

		// Verify ownership
		const item = await prisma.item.findUnique({
			where: { id },
			select: { ownerId: true, imagePath: true, mediaPaths: true },
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

		// Validate listing text against main image and supporting media before updating
		const currentItem = await prisma.item.findUnique({
			where: { id },
			select: { name: true, description: true, categories: true, tags: true },
		});
		const finalName = name !== undefined ? name.trim() : (currentItem?.name ?? '');
		const finalDescription =
			description !== undefined ? (description?.trim() ?? null) : (currentItem?.description ?? null);
		const finalCategories = categories !== undefined ? categories : (currentItem?.categories ?? []);
		const finalTags = tags !== undefined ? tags : (currentItem?.tags ?? []);
		const combinedText = buildEnrichedText({
			name: finalName,
			description: finalDescription,
			categories: finalCategories,
			tags: finalTags,
		});
		const imageEntries: { url: string; label: string }[] = [];
		const mainImageUrl =
			typeof imageUrl === 'string' && imageUrl ? imageUrl : await getSignedUrl(item.imagePath, 'items');
		imageEntries.push({ url: mainImageUrl, label: 'Main image' });
		const mediaPathsList = Array.isArray(mediaPaths) ? mediaPaths : (item.mediaPaths ?? []);
		for (let i = 0; i < mediaPathsList.length; i++) {
			try {
				const url = await getSignedUrl(mediaPathsList[i], 'media');
				imageEntries.push({ url, label: `Additional photo ${i + 1}` });
			} catch {
				// Skip if we can't get URL
			}
		}
		const validation = await validateListingAgainstImages(imageEntries, {
			name: finalName,
			description: finalDescription,
			categories: finalCategories,
			tags: finalTags,
		});
		if (!validation.valid) {
			return NextResponse.json(
				{
					error: 'Listing does not match photo(s)',
					code: 'ITEM_MISMATCH',
					message: 'Your description does not match one or more photos. Please update the text or photos.',
					details: validation.failures.map(f => ({
						imageLabel: f.imageLabel,
						reason: f.reason,
						detectedItems: f.detectedItems,
					})),
				},
				{ status: 422 },
			);
		}

		// Regenerate embedding if image or any text metadata changed
		// Embedding combines image + text metadata (name, description, categories, tags)
		let embedding: number[] | null = null;
		const imageChanged = imagePath && imagePath !== item.imagePath;
		const metadataChanged =
			name !== undefined || description !== undefined || categories !== undefined || tags !== undefined;
		if (imageChanged || metadataChanged) {
			const embeddingImageUrl = imageChanged && imageUrl ? imageUrl : await getSignedUrl(item.imagePath, 'items');
			try {
				embedding = await generateDocumentEmbedding(embeddingImageUrl, combinedText);
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
					...(mediaPaths !== undefined && { mediaPaths }),
					...(archived !== undefined && { archivedAt: archived ? new Date() : null }),
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
			// Format embedding as PostgreSQL vector literal using Prisma.raw
			const embeddingVector = Prisma.raw(`'[${embedding.join(',')}]'::vector`);
			await prisma.$executeRaw`
				UPDATE items SET embedding = ${embeddingVector}
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

		// Delete old media files if mediaPaths changed
		if (mediaPaths !== undefined && item.mediaPaths) {
			const oldMediaPaths = item.mediaPaths.filter(path => !mediaPaths.includes(path));
			for (const path of oldMediaPaths) {
				try {
					await deleteImage(path, 'media');
				} catch (deleteError) {
					console.error('Failed to delete old media file:', deleteError);
				}
			}
		}

		// Generate signed URL
		let signedImageUrl = '';
		try {
			signedImageUrl = await getSignedUrl(updatedItem.imagePath, 'items');
		} catch (err) {
			console.error(`Failed to get signed URL for updated item ${updatedItem.id}:`, err);
		}

		// Generate signed URLs for all media files (main image + supporting media)
		const mediaUrls = await Promise.all([
			signedImageUrl, // Main image is first
			...(updatedItem.mediaPaths || []).map(path =>
				getSignedUrl(path, 'media').catch(err => {
					console.error(`Failed to get signed URL for media of updated item ${updatedItem.id}:`, err);
					return '';
				}),
			),
		]);
		const updatedCircleRecords = await prisma.itemCircle.findMany({
			where: { itemId: updatedItem.id },
			include: {
				circle: {
					select: { id: true, name: true },
				},
			},
		});

		return NextResponse.json(
			{
				id: updatedItem.id,
				name: updatedItem.name,
				description: updatedItem.description,
				imageUrl: signedImageUrl,
				imagePath: updatedItem.imagePath,
				mediaUrls,
				mediaPaths: updatedItem.mediaPaths,
				categories: updatedItem.categories,
				tags: updatedItem.tags,
				createdAt: updatedItem.createdAt,
				updatedAt: updatedItem.updatedAt,
				archivedAt: updatedItem.archivedAt,
				owner: updatedItem.owner,
				circles: updatedCircleRecords.map(c => ({
					id: c.circle.id,
					name: c.circle.name,
				})),
				isOwner: true,
				isAvailable: updatedItem.isAvailable,
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
			select: { ownerId: true, imagePath: true, mediaPaths: true },
		});

		if (!item) {
			return NextResponse.json({ error: 'Item not found' }, { status: 404 });
		}

		if (item.ownerId !== userId) {
			return NextResponse.json({ error: 'You can only delete your own items' }, { status: 403 });
		}

		// Block deletion if any borrow transaction is still in progress
		const activeTransaction = await prisma.borrowTransaction.findFirst({
			where: {
				itemId: id,
				status: { notIn: [BorrowTransactionStatus.COMPLETED, BorrowTransactionStatus.CANCELLED] },
			},
			select: { id: true },
		});

		if (activeTransaction) {
			return NextResponse.json(
				{ error: 'Cannot delete this item — it has active borrow transactions. Complete or cancel all borrows first.' },
				{ status: 409 },
			);
		}

		// Delete item (cascade will handle circle associations, requests, queue entries)
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

		// Delete all media files from storage
		if (item.mediaPaths && item.mediaPaths.length > 0) {
			for (const path of item.mediaPaths) {
				try {
					await deleteImage(path, 'media');
				} catch (deleteError) {
					console.error('Failed to delete media file:', deleteError);
					// Continue deleting other files even if one fails
				}
			}
		}

		return NextResponse.json({ message: 'Item deleted successfully' }, { status: 200 });
	} catch (error) {
		console.error('Delete item error:', error);
		return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
	}
}
