import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { deleteImage } from '@/lib/supabase';

// DELETE /api/items/cleanup - Delete an orphaned image (for cancellation)
export async function DELETE(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = session.user.id;
		const body = await req.json();
		const { imagePath } = body;

		if (!imagePath || typeof imagePath !== 'string') {
			return NextResponse.json({ error: 'Image path is required' }, { status: 400 });
		}

		// Security check: Only allow deleting images in user's own folder
		// Image paths are formatted as: userId/timestamp.ext
		if (!imagePath.startsWith(`${userId}/`)) {
			return NextResponse.json({ error: 'You can only delete your own images' }, { status: 403 });
		}

		// Delete the image from storage
		await deleteImage(imagePath, 'items');

		return NextResponse.json({ message: 'Image deleted successfully' }, { status: 200 });
	} catch (error) {
		console.error('Cleanup error:', error);
		return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
	}
}


