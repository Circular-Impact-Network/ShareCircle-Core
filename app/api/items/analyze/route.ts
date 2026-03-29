import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { analyzeImage, validateItemInImage } from '@/lib/ai';
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

		// Validate that the user's description matches something in the image
		// This prevents users from describing items that don't exist in the photo
		if (userHint && typeof userHint === 'string' && userHint.trim()) {
			try {
				const validation = await validateItemInImage(imageUrl, userHint.trim());
				
				if (!validation.isValid) {
					return NextResponse.json(
						{
							error: 'Item not found in image',
							code: 'ITEM_NOT_FOUND',
							message: `The item you described ("${userHint}") was not found in the photo. ${validation.reason}`,
							detectedItems: validation.detectedItems,
							suggestion: validation.detectedItems.length > 0
								? `Items detected in the photo: ${validation.detectedItems.slice(0, 5).join(', ')}${validation.detectedItems.length > 5 ? '...' : ''}`
								: 'Please try with a different photo or description.',
						},
						{ status: 422 }
					);
				}
				
				// If validation found a matched item, use it to refine the analysis
				if (validation.matchedItem) {
					}
			} catch (validationError) {
				// Log but don't fail - validation is a nice-to-have, not required
				console.error('Validation failed, proceeding with analysis:', validationError);
			}
		}

		// Also validate for selectedItem (Option 2 flow)
		if (selectedItem && typeof selectedItem === 'string' && selectedItem.trim()) {
			try {
				const validation = await validateItemInImage(imageUrl, selectedItem.trim());
				
				if (!validation.isValid) {
					return NextResponse.json(
						{
							error: 'Selected item not found in image',
							code: 'ITEM_NOT_FOUND',
							message: `The selected item ("${selectedItem}") was not found in the photo. ${validation.reason}`,
							detectedItems: validation.detectedItems,
							suggestion: validation.detectedItems.length > 0
								? `Items detected in the photo: ${validation.detectedItems.slice(0, 5).join(', ')}${validation.detectedItems.length > 5 ? '...' : ''}`
								: 'Please try selecting a different item.',
						},
						{ status: 422 }
					);
				}
			} catch (validationError) {
				// Log but don't fail - validation is a nice-to-have, not required
				console.error('Validation failed, proceeding with analysis:', validationError);
			}
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


