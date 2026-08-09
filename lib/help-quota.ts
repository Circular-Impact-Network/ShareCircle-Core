import { prisma } from '@/lib/prisma';

/**
 * Daily and hourly caps on the help bot, counted in the database.
 *
 * `lib/rate-limit.ts` keeps its counters in a module-level Map. That is per process and is wiped by
 * every deploy, which makes it a reasonable burst guard and useless as a ceiling on spend: a user
 * could exceed any daily limit simply by being unlucky enough to talk across a restart. Counting
 * rows means the limit survives restarts and is auditable afterwards.
 */

export const HELP_BOT_DAILY_LIMIT = 30;
export const HELP_BOT_HOURLY_LIMIT = 8;

export const HELP_BOT_PURPOSE = 'help-chat';

export type QuotaVerdict = { allowed: true } | { allowed: false; reason: string; retryAfterSeconds: number };

/**
 * Claim one unit of quota, or refuse.
 *
 * Records first and counts afterwards, which is what makes this safe under concurrency. Counting
 * and then inserting is a read-then-write race: fire twenty requests at once and all twenty read
 * the same pre-insert count, all twenty pass, and a daily cap of thirty buys as many model calls as
 * the caller has sockets. Inserting first means each request's own row is committed before it
 * counts, so a request can only see a total at least as large as its own position in the burst —
 * and at most `limit` of them can see a total within the limit, however they interleave.
 *
 * The cost is that a refused request still consumes a row. That is the intended direction: the row
 * is the evidence of the attempt, and over-counting a burst is far cheaper than under-counting it.
 */
export async function claimHelpBotQuota(userId: string, now = new Date()): Promise<QuotaVerdict> {
	const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

	let usageId: string;
	try {
		const row = await prisma.aiUsage.create({
			data: { userId, purpose: HELP_BOT_PURPOSE, refused: false },
			select: { id: true },
		});
		usageId = row.id;
	} catch (error) {
		// Fail closed. This insert is the only thing bounding spend on a paid model, so if it cannot
		// be written the ceiling does not exist — and a user reading "unavailable" is cheaper than
		// an unmetered, unlogged bill.
		console.error('Failed to record help bot usage; refusing rather than spending unmetered:', error);
		return {
			allowed: false,
			reason: 'The assistant is unavailable right now. Please try again shortly.',
			retryAfterSeconds: 60,
		};
	}

	const [daily, hourly] = await Promise.all([
		prisma.aiUsage.count({ where: { userId, purpose: HELP_BOT_PURPOSE, createdAt: { gte: dayAgo } } }),
		prisma.aiUsage.count({ where: { userId, purpose: HELP_BOT_PURPOSE, createdAt: { gte: hourAgo } } }),
	]);

	const over =
		hourly > HELP_BOT_HOURLY_LIMIT
			? {
					reason: `You have reached the hourly limit of ${HELP_BOT_HOURLY_LIMIT} questions. Please try again later.`,
					retryAfterSeconds: 60 * 60,
				}
			: daily > HELP_BOT_DAILY_LIMIT
				? {
						reason: `You have reached the daily limit of ${HELP_BOT_DAILY_LIMIT} questions. Please try again tomorrow.`,
						retryAfterSeconds: 24 * 60 * 60,
					}
				: null;

	if (!over) {
		return { allowed: true };
	}

	// Mark the row so refusals are distinguishable from answered questions. Best effort: the row
	// already counts against the window, which is the part that must not be lost.
	await prisma.aiUsage
		.update({ where: { id: usageId }, data: { refused: true } })
		.catch(error => console.error('Failed to flag a refused help bot request:', error));

	return { allowed: false, ...over };
}
