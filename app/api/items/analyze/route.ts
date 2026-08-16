import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { analyzeImage, validateItemInImage } from '@/lib/ai';
import { aiFailureResponse } from '@/lib/ai-errors';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { checkOwnSupabaseUrl } from '@/lib/supabase-url';

export const maxDuration = 60;

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

		// Must be an object in our own Supabase project, not merely somewhere on supabase.co.
		const urlCheck = checkOwnSupabaseUrl(imageUrl);
		if (!urlCheck.ok) {
			if (urlCheck.reason === 'unconfigured') {
				console.error('NEXT_PUBLIC_SUPABASE_URL is not set; cannot validate image URLs.');
				return NextResponse.json({ error: 'Image storage is not configured' }, { status: 500 });
			}
			return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
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
							suggestion:
								validation.detectedItems.length > 0
									? `Items detected in the photo: ${validation.detectedItems.slice(0, 5).join(', ')}${validation.detectedItems.length > 5 ? '...' : ''}`
									: 'Please try with a different photo or description.',
						},
						{ status: 422 },
					);
				}

				// If validation found a matched item, we could refine the analysis (placeholder for future use)
				if (validation.matchedItem) {
					void validation.matchedItem;
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
							suggestion:
								validation.detectedItems.length > 0
									? `Items detected in the photo: ${validation.detectedItems.slice(0, 5).join(', ')}${validation.detectedItems.length > 5 ? '...' : ''}`
									: 'Please try selecting a different item.',
						},
						{ status: 422 },
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
		// Shared with /api/items/detect — see lib/ai-errors. Never forwards the provider's own
		// message, which arrives as a multi-line quota dump with request ids in it.
		return aiFailureResponse(error, 'Failed to analyze image');
	}
}
