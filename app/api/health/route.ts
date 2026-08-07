import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkEnv } from '@/lib/env';
import { isPushConfigured } from '@/lib/push';

// Always evaluated fresh — a cached health check reports the state of a past request.
export const dynamic = 'force-dynamic';

/**
 * GET /api/health — liveness plus the two dependencies that can be broken while the process is
 * perfectly alive: the database and the environment.
 *
 * There was no health endpoint at all, so the only way to discover a bad deploy was for a user to
 * hit the broken path. Deliberately unauthenticated (an uptime probe has no session) and
 * deliberately terse: it reports *that* something is wrong and which of the two it is, never
 * connection strings, key material, or error text from the driver.
 */
export async function GET() {
	const env = checkEnv();

	let database: 'ok' | 'unreachable' = 'ok';
	try {
		await prisma.$queryRaw`SELECT 1`;
	} catch (error) {
		database = 'unreachable';
		console.error('Health check: database unreachable:', error);
	}

	const healthy = database === 'ok' && env.ok;

	return NextResponse.json(
		{
			status: healthy ? 'ok' : 'degraded',
			database,
			env: env.ok ? 'ok' : 'incomplete',
			// Reported separately because "the variables are set" and "web-push accepted them" are
			// different things: a subject that is not a mailto:/https URL is present but rejected.
			push: isPushConfigured() ? 'ok' : 'not-configured',
			// Names only. `checkEnv` yields messages built from variable names, never values.
			missing: env.missing,
			warnings: env.warnings,
			timestamp: new Date().toISOString(),
		},
		{ status: healthy ? 200 : 503 },
	);
}
