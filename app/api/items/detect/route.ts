import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { detectItems } from '@/lib/ai';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

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

		// Detect all items in the image using Gemini Vision
		const detection = await detectItems(imageUrl);

		return NextResponse.json(detection, { status: 200 });
	} catch (error) {
		console.error('Item detection error:', error);

		// Provide more specific error messages
		if (error instanceof Error) {
			if (error.message.includes('API key')) {
				return NextResponse.json({ error: 'AI service configuration error' }, { status: 500 });
			}
			if (error.message.includes('rate limit')) {
				return NextResponse.json({ error: 'AI service rate limit reached. Please try again later.' }, { status: 429 });
			}
		}

		return NextResponse.json({ error: 'Failed to detect items in image' }, { status: 500 });
	}
}
