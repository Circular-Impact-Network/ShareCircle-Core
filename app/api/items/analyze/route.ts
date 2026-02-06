import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { analyzeImage } from '@/lib/ai';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

// POST /api/items/analyze - Analyze an image using AI
export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Rate limiting for AI endpoints
		const identifier = getClientIdentifier(req, session.user.id);
		const rateLimitResult = checkRateLimit(identifier, 'items-analyze', RATE_LIMITS.ai);
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const body = await req.json();
		const { imageUrl, selectedItem, userHint } = body;

		if (!imageUrl || typeof imageUrl !== 'string') {
			return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
		}

		// Analyze the image using Gemini Vision
		// Pass optional selectedItem (Option 2) or userHint (Option 1) if provided
		const analysis = await analyzeImage(imageUrl, {
			selectedItem: selectedItem || undefined,
			userHint: userHint || undefined,
		});

		return NextResponse.json(analysis, { status: 200 });
	} catch (error) {
		console.error('Image analysis error:', error);

		// Provide more specific error messages
		if (error instanceof Error) {
			if (error.message.includes('API key')) {
				return NextResponse.json({ error: 'AI service configuration error' }, { status: 500 });
			}
			if (error.message.includes('rate limit')) {
				return NextResponse.json({ error: 'AI service rate limit reached. Please try again later.' }, { status: 429 });
			}
		}

		return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 });
	}
}


