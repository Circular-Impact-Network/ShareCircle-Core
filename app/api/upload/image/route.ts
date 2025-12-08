import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadImage, getSignedUrl } from '@/lib/supabase';

export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

		// Upload to Supabase and get file path
		const filePath = await uploadImage(file, 'avatars', session.user.id);

		// Generate signed URL (valid for 1 year)
		const signedUrl = await getSignedUrl(filePath, 'avatars');

		return NextResponse.json(
			{
				url: signedUrl,
				path: filePath,
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error('Image upload error:', error);
		return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
	}
}
