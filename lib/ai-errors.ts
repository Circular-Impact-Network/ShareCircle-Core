import { NextResponse } from 'next/server';
import { NoObjectGeneratedError } from 'ai';

/**
 * One translation from a provider failure into something a person can act on.
 *
 * Both AI routes carried their own copy of this and they had drifted apart. The analyze route knew
 * about quota exhaustion and turned it into a readable sentence; the detect route recognised only
 * the literal words "rate limit" and answered everything else with "Failed to detect items in
 * image". So a missing API key, an exhausted quota, an unreadable photo and a model that simply
 * returned nothing all reached the user as the same dead end, and the difference existed only in a
 * server log — which is no help at all when the failure is intermittent and gets reported hours
 * later from somebody's phone.
 *
 * The `code` is the point: it is stable, it is safe to show, and it says which of those four
 * happened. The provider's own message is never forwarded — it arrives as a multi-line quota dump
 * with request ids in it.
 */
export function aiFailureResponse(error: unknown, fallback: string): NextResponse {
	// Not an API error at all: the call succeeded and the model's reply did not satisfy the schema.
	// lib/ai.ts already retried once, so reaching here means it failed twice on the same image.
	if (NoObjectGeneratedError.isInstance(error)) {
		return NextResponse.json(
			{
				error: 'The AI could not read enough detail from that photo. Try a clearer or closer shot, or enter the details yourself.',
				code: 'AI_NO_RESULT',
			},
			{ status: 503 },
		);
	}

	const message = error instanceof Error ? error.message.toLowerCase() : '';

	if (message.includes('api key') || message.includes('api_key')) {
		return NextResponse.json({ error: 'AI service configuration error', code: 'AI_CONFIG' }, { status: 500 });
	}

	// Gemini reports quota as any of "quota", "exceeded", "rate limit", "resource_exhausted" or 429.
	if (
		message.includes('quota') ||
		message.includes('exceeded') ||
		message.includes('rate limit') ||
		message.includes('rate_limit') ||
		message.includes('resource_exhausted') ||
		message.includes('429') ||
		message.includes('too many requests')
	) {
		return NextResponse.json(
			{
				error: 'AI is busy right now (usage limit reached). Please try again in a minute, or fill in the details manually.',
				code: 'AI_RATE_LIMITED',
			},
			{ status: 429 },
		);
	}

	// The provider fetched the image and could not decode it. Distinct from every other failure
	// because it is the one the user can actually fix, by choosing a different photo.
	if (message.includes('unable to process input image') || message.includes('invalid image')) {
		return NextResponse.json(
			{ error: 'That image could not be read. Please try a different photo.', code: 'AI_IMAGE_UNREADABLE' },
			{ status: 400 },
		);
	}

	return NextResponse.json({ error: fallback, code: 'AI_UNAVAILABLE' }, { status: 500 });
}
