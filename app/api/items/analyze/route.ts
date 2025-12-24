import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { analyzeImage } from '@/lib/ai';

// POST /api/items/analyze - Analyze an image using AI
export async function POST(req: NextRequest) {
	try {
		const session = await getServerSession(authOptions);

		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json();
		const { imageUrl } = body;

		if (!imageUrl || typeof imageUrl !== 'string') {
			return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
		}

		// Analyze the image using Gemini Vision
		const analysis = await analyzeImage(imageUrl);

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


