import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MemberRole } from '@prisma/client';
import { uploadImage, getSignedUrl, deleteImage } from '@/lib/supabase';

// POST /api/circles/[id]/avatar - Upload circle avatar (admin only)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: circleId } = await params;
		const userId = session.user.id;

		// Check if user is an admin of this circle
		const membership = await prisma.circleMember.findUnique({
			where: {
				circleId_userId: {
					circleId,
					userId,
				},
			},
		});

		if (!membership || membership.leftAt || membership.role !== MemberRole.ADMIN) {
			return NextResponse.json({ error: 'Only admins can update circle avatar' }, { status: 403 });
		}

		// Get the current circle to check for existing avatar
		const circle = await prisma.circle.findUnique({
			where: { id: circleId },
			select: { avatarUrl: true },
		});

		if (!circle) {
			return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
		}

		const formData = await req.formData();
		const file = formData.get('file') as File;

		if (!file) {
			return NextResponse.json({ error: 'No file provided' }, { status: 400 });
		}

		// Validate file type
		const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
		if (!validTypes.includes(file.type)) {
			return NextResponse.json(
				{ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' },
				{ status: 400 },
			);
		}

		// Validate file size (max 5MB)
		const maxSize = 5 * 1024 * 1024;
		if (file.size > maxSize) {
			return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
		}

		// Delete old avatar if exists
		const parsePathFromUrl = (url?: string | null) => {
			if (!url) return null;
			try {
				const u = new URL(url);
				// signed URL path format: /storage/v1/object/sign/<bucket>/<path>?...
				const parts = u.pathname.split('/object/sign/');
				if (parts.length === 2) {
					const afterSign = parts[1];
					const pathWithBucket = afterSign.split('?')[0];
					const bucketAndPath = pathWithBucket.split('/');
					bucketAndPath.shift(); // remove bucket
					return bucketAndPath.join('/');
				}
			} catch {
				return null;
			}
			return null;
		};

		const existingPath = parsePathFromUrl(circle.avatarUrl);

		// Upload new avatar to Supabase
		// Using circleId as the folder to organize files
		const filePath = await uploadImage(file, 'circle-avatars', circleId);

		// Generate signed URL (valid for 1 year)
		const signedUrl = await getSignedUrl(filePath, 'circle-avatars');

		// Update circle with new avatar info
		const updatedCircle = await prisma.circle.update({
			where: { id: circleId },
			data: {
				avatarUrl: signedUrl,
			},
		});

		return NextResponse.json(
			{
				avatarUrl: updatedCircle.avatarUrl,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Circle avatar upload error:', error);
		return NextResponse.json({ error: 'Failed to upload avatar' }, { status: 500 });
	}
}

// DELETE /api/circles/[id]/avatar - Remove circle avatar (admin only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { id: circleId } = await params;
		const userId = session.user.id;

		// Check if user is an admin of this circle
		const membership = await prisma.circleMember.findUnique({
			where: {
				circleId_userId: {
					circleId,
					userId,
				},
			},
		});

		if (!membership || membership.leftAt || membership.role !== MemberRole.ADMIN) {
			return NextResponse.json({ error: 'Only admins can remove circle avatar' }, { status: 403 });
		}

		// Get the current circle
		const circle = await prisma.circle.findUnique({
			where: { id: circleId },
			select: { avatarUrl: true },
		});

		if (!circle) {
			return NextResponse.json({ error: 'Circle not found' }, { status: 404 });
		}

		// Delete avatar from storage if exists
		const parsePathFromUrl = (url?: string | null) => {
			if (!url) return null;
			try {
				const u = new URL(url);
				const parts = u.pathname.split('/object/sign/');
				if (parts.length === 2) {
					const afterSign = parts[1];
					const pathWithBucket = afterSign.split('?')[0];
					const bucketAndPath = pathWithBucket.split('/');
					bucketAndPath.shift();
					return bucketAndPath.join('/');
				}
			} catch {
				return null;
			}
			return null;
		};

		const existingPath = parsePathFromUrl(circle.avatarUrl);
		if (existingPath) {
			try {
				await deleteImage(existingPath, 'circle-avatars');
			} catch (error) {
				console.error('Failed to delete avatar from storage:', error);
			}
		}

		// Update circle to remove avatar info
		await prisma.circle.update({
			where: { id: circleId },
			data: {
				avatarUrl: null,
			},
		});

		return NextResponse.json({ message: 'Avatar removed successfully' }, { status: 200 });
	} catch (error) {
		console.error('Circle avatar delete error:', error);
		return NextResponse.json({ error: 'Failed to remove avatar' }, { status: 500 });
	}
}
