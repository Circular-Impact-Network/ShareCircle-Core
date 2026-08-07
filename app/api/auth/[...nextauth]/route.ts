import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';
import { RATE_LIMITS, checkRateLimit, getClientIdentifier, rateLimitResponse } from '@/lib/rate-limit';

const handler = NextAuth(authOptions);

/**
 * The credentials callback is the one auth endpoint that verifies a secret, and it was the only
 * one with no rate limit.
 *
 * Every sibling route (`signup`, `verify-otp`, `forgot-password`, `reset-password`,
 * `change-password`) calls `checkRateLimit`, and `middleware.ts` excludes `/api` from its matcher,
 * so `POST /api/auth/callback/credentials` accepted unlimited attempts. That covers both password
 * guessing and — more sharply — OTP guessing: codes are six digits (900k keyspace) and live for
 * ten minutes, while the *send* limit throttles only the issuing side and does nothing to the
 * guessing side.
 *
 * Scoped to the credentials callback by pathname rather than applied to every POST, because
 * NextAuth also serves signout and CSRF over POST and those must not be throttled at auth rates.
 *
 * Keyed on IP. That is a real limitation behind NAT and — per lib/rate-limit.ts — the store is
 * per-instance in memory, so the effective ceiling scales with instance count. Both are worth
 * fixing with a shared store; neither is a reason to leave the endpoint entirely unthrottled.
 */
const CREDENTIALS_CALLBACK_PATH = '/api/auth/callback/credentials';

type RouteContext = { params: Promise<{ nextauth: string[] }> };

export async function POST(req: Request, ctx: RouteContext) {
	if (new URL(req.url).pathname === CREDENTIALS_CALLBACK_PATH) {
		const result = checkRateLimit(getClientIdentifier(req), 'auth-credentials', RATE_LIMITS.auth);
		if (!result.success) {
			return rateLimitResponse(result);
		}
	}

	return handler(req, ctx);
}

export { handler as GET };
