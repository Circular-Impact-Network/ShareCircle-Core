import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { detectItems } from '@/lib/ai';
import { aiFailureResponse } from '@/lib/ai-errors';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { checkOwnSupabaseUrl } from '@/lib/supabase-url';

export const maxDuration = 60;

// POST /api/items/detect - Detect all items in an image (Option 2 flow)
export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Rate limiting for AI endpoints
		const identifier = getClientIdentifier(req, session.user.id);
		const rateLimitResult = checkRateLimit(identifier, 'items-detect', RATE_LIMITS.ai);
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const body = await req.json();
		const { imageUrl } = body;

		if (!imageUrl || typeof imageUrl !== 'string') {
			return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
		}

		// Must be an object in our own Supabase project, not merely somewhere on supabase.co.
		const urlCheck = checkOwnSupabaseUrl(imageUrl);
		if (!urlCheck.ok) {
			if (urlCheck.reason === 'unconfigured') {
				console.error('NEXT_PUBLIC_SUPABASE_URL is not set; cannot validate image URLs.');
				return NextResponse.json({ error: 'Image storage is not configured' }, { status: 500 });
			}
			return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
		}

		// Detect all items in the image using Gemini Vision
		const detection = await detectItems(imageUrl);

		return NextResponse.json(detection, { status: 200 });
	} catch (error) {
		console.error('Item detection error:', error);
		return aiFailureResponse(error, 'Failed to detect items in image');
	}
}
