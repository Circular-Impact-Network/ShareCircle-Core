import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';

// Vision/audio model calls can exceed the default serverless timeout.
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB — plenty for short voice notes
const ALLOWED_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a'];

/**
 * Transcribe a short audio recording to text via Gemini.
 * Accepts multipart/form-data with an `audio` file field. Returns { text }.
 */
export async function POST(request: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return Response.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const identifier = getClientIdentifier(request, session.user.id);
		const rateLimitResult = checkRateLimit(identifier, 'transcribe', RATE_LIMITS.ai);
		if (!rateLimitResult.success) {
			return rateLimitResponse(rateLimitResult);
		}

		const form = await request.formData();
		const audio = form.get('audio');
		if (!(audio instanceof Blob) || audio.size === 0) {
			return Response.json({ error: 'No audio provided' }, { status: 400 });
		}
		if (audio.size > MAX_AUDIO_BYTES) {
			return Response.json({ error: 'Audio is too long. Keep it under a minute.' }, { status: 400 });
		}

		// Gemini keys off the media type; fall back to webm (what MediaRecorder emits by default).
		const mediaType = ALLOWED_TYPES.includes(audio.type) ? audio.type : 'audio/webm';
		const bytes = new Uint8Array(await audio.arrayBuffer());

		const { text } = await generateText({
			model: google('gemini-2.5-flash'),
			maxRetries: 2,
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'file', data: bytes, mediaType },
						{
							type: 'text',
							text: 'Transcribe this audio verbatim into plain text. Return ONLY the transcript, with no preamble, quotes, or commentary. If there is no discernible speech, return an empty string.',
						},
					],
				},
			],
		});

		return Response.json({ text: text.trim() }, { status: 200 });
	} catch (error) {
		console.error('Transcribe error:', error);
		return Response.json({ error: 'Failed to transcribe audio. Please try again.' }, { status: 500 });
	}
}
