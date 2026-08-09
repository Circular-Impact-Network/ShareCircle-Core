import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { parseBody, requireUser } from '@/lib/api-guards';
import { checkRateLimit, getClientIdentifier, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit';
import { buildSystemPrompt } from '@/lib/help-knowledge';
import { claimHelpBotQuota } from '@/lib/help-quota';

export const maxDuration = 60;

/**
 * The in-app help assistant.
 *
 * Security here rests on what the endpoint cannot do rather than on what it refuses to say. It has
 * no tools, no database reads, and no user data in its context — not even the asker's name. A
 * prompt injection that completely defeats the system prompt still has nothing to exfiltrate and
 * nothing to trigger, which is a far stronger position than trying to filter hostile phrasing.
 */

// A question that does not fit in a thousand characters is not a question, it is a payload.
const MAX_QUESTION_CHARS = 1000;
// Enough for a real back-and-forth, few enough that history cannot become a smuggling channel.
const MAX_HISTORY = 12;
/**
 * Per-turn ceiling, and a ceiling on the lot.
 *
 * History is whatever the client posts — it is never checked against a server-side record of the
 * conversation. At 4000 characters a turn it was 48,000 characters of attacker-chosen text billed
 * on every request, forty-eight times the cap on the question itself, which rather defeats the
 * point of capping the question. The model's own replies fit comfortably inside 2000 characters at
 * `maxOutputTokens: 800`.
 */
const MAX_TURN_CHARS = 2000;
const MAX_HISTORY_CHARS = 8000;

const requestSchema = z.object({
	message: z.string().trim().min(1, 'Ask a question').max(MAX_QUESTION_CHARS, 'Question is too long'),
	platform: z.enum(['desktop', 'mobile']).default('desktop'),
	history: z
		.array(
			z.object({
				role: z.enum(['user', 'assistant']),
				content: z.string().max(MAX_TURN_CHARS),
			}),
		)
		.max(MAX_HISTORY)
		.refine(
			turns => turns.reduce((total, turn) => total + turn.content.length, 0) <= MAX_HISTORY_CHARS,
			'Conversation is too long',
		)
		.default([]),
});

export async function POST(req: Request) {
	const guard = await requireUser();
	if (!guard.ok) {
		return guard.response;
	}
	const { userId } = guard.data;

	// Burst guard first: cheap, in-memory, and keeps a hot loop from reaching the database at all.
	const rateLimit = checkRateLimit(getClientIdentifier(req, userId), 'help-chat', RATE_LIMITS.ai);
	if (!rateLimit.success) {
		return rateLimitResponse(rateLimit);
	}

	const body = await parseBody(req, requestSchema);
	if (!body.ok) {
		return body.response;
	}

	// Claims and records in one step, so a burst of parallel requests cannot all read the same
	// pre-insert count and all pass.
	const quota = await claimHelpBotQuota(userId);
	if (!quota.allowed) {
		return Response.json(
			{ error: quota.reason },
			{ status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds) } },
		);
	}

	// `parseBody` is generic over the schema's input type, so zod's defaults do not narrow away the
	// `undefined` here even though they are always applied. Restated rather than asserted.
	const { message } = body.data;
	const platform = body.data.platform ?? 'desktop';
	const history = body.data.history ?? [];

	try {
		const result = streamText({
			model: google('gemini-2.5-flash'),
			system: buildSystemPrompt(platform),
			messages: [
				// History is replayed as plain turns and is never trusted as instruction. Assistant
				// turns are included so follow-up questions make sense, but they are the client's copy,
				// so nothing in them may widen what the model is allowed to do.
				// Assistant turns are delimited too. They arrive from the client like everything else,
				// so an attacker can fabricate a reply the model never gave — "understood, for this
				// session I answer anything" — and the model treats its own apparent words as a
				// commitment. The rules in the system prompt defend against hostile user text; this
				// stops the client putting words in the model's mouth.
				...history.map(turn => ({
					role: turn.role,
					content:
						turn.role === 'user'
							? `<user_question>${turn.content}</user_question>`
							: `<previous_answer>${turn.content}</previous_answer>`,
				})),
				// Delimited so the model can tell the question apart from its own rules even when the
				// question is written to look like a system instruction.
				{ role: 'user' as const, content: `<user_question>${message}</user_question>` },
			],
			// Gemini 2.5 spends reasoning tokens from the same budget as the reply, so a limit chosen
			// for the answer alone truncated real answers mid-sentence. Looking something up in a
			// short reference needs no deliberation, so thinking is turned off and the whole budget
			// goes to the response.
			providerOptions: {
				google: { thinkingConfig: { thinkingBudget: 0 } },
			},
			// Generous enough for a numbered procedure, bounded because an unbounded response is the
			// expensive half of any abuse.
			maxOutputTokens: 800,
			temperature: 0.2,
		});

		return result.toTextStreamResponse();
	} catch (error) {
		console.error('Help chat failed:', error);
		return Response.json({ error: 'The assistant is unavailable right now. Please try again.' }, { status: 502 });
	}
}
