import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
	/**
	 * Matches the guard on the sibling test routes (create-session, get-otp). This one used the
	 * blunter `NODE_ENV === 'production'` check, which meant it 403'd on every CI run: the e2e job
	 * serves a production build, so teardown's cleanup call was rejected and global-teardown only
	 * `console.warn`ed about it. That is why six months of test accounts accumulated on dev.
	 *
	 * Still closed on the real production deployment, where TEST_CLEANUP_SECRET is not set, and the
	 * secret comparison below is required regardless.
	 */
	if (process.env.NODE_ENV === 'production' && !process.env.TEST_CLEANUP_SECRET) {
		return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
	}

	const secret = req.headers.get('x-test-cleanup-secret');
	if (!secret || secret !== process.env.TEST_CLEANUP_SECRET) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await req.json();
		const emails = Array.isArray(body?.emails) ? (body.emails as string[]) : [];
		// Hours after which any leftover test account is fair game. Optional — omit to keep the
		// original behaviour of deleting only the listed emails.
		const sweepOlderThanHours = typeof body?.sweepOlderThanHours === 'number' ? body.sweepOlderThanHours : null;

		if (emails.length === 0 && sweepOlderThanHours === null) {
			return NextResponse.json({ error: 'No emails provided' }, { status: 400 });
		}

		const deletedForEmails = emails.length
			? (await prisma.user.deleteMany({ where: { email: { in: emails } } })).count
			: 0;

		if (emails.length) {
			await prisma.testOtp.deleteMany({ where: { email: { in: emails } } });
		}

		/**
		 * Sweep abandoned test accounts.
		 *
		 * Deleting only the emails from the current run leaves everything behind whenever a run
		 * crashes, is cancelled, or never reaches teardown. Six months of that had accumulated 252
		 * test users, 2,822 circles and 4,018 memberships on the dev database, which is what made
		 * the slower e2e specs time out on CI — list endpoints and search were doing real work over
		 * junk data.
		 *
		 * Scoped to the documented `e2e+…` pattern and to accounts older than the cutoff, so a run
		 * executing in parallel is never touched. Deleting the user cascades to their circles,
		 * items, messages and memberships.
		 */
		let sweptUsers = 0;
		if (sweepOlderThanHours !== null) {
			const cutoff = new Date(Date.now() - sweepOlderThanHours * 60 * 60 * 1000);
			const stale = await prisma.user.findMany({
				where: { email: { startsWith: 'e2e+' }, created_at: { lt: cutoff } },
				select: { id: true, email: true },
			});

			// Delete in chunks: a single `in` list of several hundred ids times out on the pooler.
			for (let i = 0; i < stale.length; i += 25) {
				const chunk = stale.slice(i, i + 25);
				const result = await prisma.user.deleteMany({ where: { id: { in: chunk.map(u => u.id) } } });
				sweptUsers += result.count;
				await prisma.testOtp.deleteMany({
					where: { email: { in: chunk.map(u => u.email).filter((e): e is string => Boolean(e)) } },
				});
			}
		}

		return NextResponse.json({ deleted: deletedForEmails, swept: sweptUsers }, { status: 200 });
	} catch (error) {
		console.error('Test cleanup error:', error);
		return NextResponse.json({ error: 'Failed to cleanup test data' }, { status: 500 });
	}
}
