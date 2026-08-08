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

export async function checkHelpBotQuota(userId: string, now = new Date()): Promise<QuotaVerdict> {
	const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
	const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

	// Refused requests are counted too. Otherwise the cheapest way to burn the quota — spamming
	// prompts that get refused — would be free and unlimited.
	const [daily, hourly] = await Promise.all([
		prisma.aiUsage.count({
			where: { userId, purpose: HELP_BOT_PURPOSE, createdAt: { gte: dayAgo } },
		}),
		prisma.aiUsage.count({
			where: { userId, purpose: HELP_BOT_PURPOSE, createdAt: { gte: hourAgo } },
		}),
	]);

	if (hourly >= HELP_BOT_HOURLY_LIMIT) {
		return {
			allowed: false,
			reason: `You have reached the hourly limit of ${HELP_BOT_HOURLY_LIMIT} questions. Please try again later.`,
			retryAfterSeconds: 60 * 60,
		};
	}

	if (daily >= HELP_BOT_DAILY_LIMIT) {
		return {
			allowed: false,
			reason: `You have reached the daily limit of ${HELP_BOT_DAILY_LIMIT} questions. Please try again tomorrow.`,
			retryAfterSeconds: 24 * 60 * 60,
		};
	}

	return { allowed: true };
}

export async function recordHelpBotUsage(userId: string, refused: boolean): Promise<void> {
	try {
		await prisma.aiUsage.create({
			data: { userId, purpose: HELP_BOT_PURPOSE, refused },
		});
	} catch (error) {
		// Never fail a user's question because bookkeeping failed.
		console.error('Failed to record help bot usage:', error);
	}
}
