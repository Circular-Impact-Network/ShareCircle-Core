import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

export const maxDuration = 60;

export async function POST(request: Request) {
	try {
		// Authentication check
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Rate limiting for AI endpoints
		const identifier = getClientIdentifier(request, session.user.id);
		const rateLimitResult = checkRateLimit(identifier, 'generate-description', RATE_LIMITS.ai);
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const { itemTitle } = await request.json();

		if (!itemTitle) {
			return Response.json({ error: 'Item title is required' }, { status: 400 });
		}

		// Input validation - limit title length to prevent abuse
		if (typeof itemTitle !== 'string' || itemTitle.length > 200) {
			return Response.json({ error: 'Invalid item title' }, { status: 400 });
		}

		const { text } = await generateText({
			model: google('gemini-2.5-flash'),
			maxRetries: 2,
			system: 'Generate compelling, brief product descriptions for a sharing/lending app. Keep responses 2-3 sentences, concise and friendly. Include practical information that helps someone decide to borrow the item. Do not include price information.',
			prompt: `Item name: ${itemTitle}`,
		});

		return Response.json({ description: text });
	} catch (error) {
		console.error('Error generating description:', error);
		return Response.json({ error: 'Failed to generate description' }, { status: 500 });
	}
}
