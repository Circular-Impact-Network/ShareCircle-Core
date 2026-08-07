import { z } from 'zod';

/**
 * One declaration of what this app needs from its environment.
 *
 * Twenty-five distinct `process.env.*` keys were read across the codebase with nothing asserting
 * any of them existed. A missing variable therefore surfaced as a runtime failure on whichever
 * request first touched it — a 500 on signup for a missing `RESEND_API_KEY`, a dead realtime
 * socket for a missing `SUPABASE_JWT_SECRET` — long after the deploy that caused it was declared
 * healthy. `checkEnv()` turns that into one answer available at boot and from `/api/health`.
 *
 * Deliberately not thrown at import time: Next evaluates modules during `next build`, where a
 * production secret set is neither present nor required, and a throw there breaks the build for
 * the wrong reason. Callers decide what to do with the result.
 */
/** `z.string().url()` accepts `localhost:3003` — scheme-less values must still be rejected. */
const absoluteUrl = z
	.string()
	.min(1)
	.refine(value => /^https?:\/\//.test(value), 'must be an absolute http(s) URL');

const requiredSchema = z.object({
	DATABASE_URL: z.string().min(1),
	NEXTAUTH_SECRET: z.string().min(1),
	NEXTAUTH_URL: absoluteUrl,
	NEXT_PUBLIC_SUPABASE_URL: absoluteUrl,
	NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
	SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
	SUPABASE_JWT_SECRET: z.string().min(1),
});

/**
 * Absent in development, but their absence in production silently disables a user-visible
 * feature rather than breaking a request, which is exactly the kind of thing that goes unnoticed.
 */
/**
 * `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is the name `lib/push.ts` actually reads. An earlier version of
 * this list said `VAPID_PUBLIC_KEY`, which sent an operator looking for a variable nothing uses.
 *
 * It is also `NEXT_PUBLIC_`, so Next inlines it at **build** time: setting it on the host and
 * restarting is not enough, the app has to be rebuilt or the browser still ships without a key
 * and the push toggle stays disabled.
 */
const PRODUCTION_RECOMMENDED = [
	'DIRECT_URL',
	'RESEND_API_KEY',
	'NEXT_PUBLIC_VAPID_PUBLIC_KEY',
	'VAPID_PRIVATE_KEY',
	'VAPID_SUBJECT',
] as const;

export type EnvCheck = {
	ok: boolean;
	missing: string[];
	warnings: string[];
};

export function checkEnv(env: NodeJS.ProcessEnv = process.env): EnvCheck {
	const parsed = requiredSchema.safeParse(env);
	// Built from `issue.path`, because zod's own message for an absent key is a bare "Required" —
	// a health check that reports "Required Required" tells an operator nothing.
	const missing = parsed.success
		? []
		: parsed.error.issues.map(issue => {
				const name = issue.path.join('.') || 'environment';
				return issue.code === 'invalid_type' ? `${name} is required` : `${name} ${issue.message}`;
			});

	const warnings = PRODUCTION_RECOMMENDED.filter(key => !env[key]).map(
		key => `${key} is not set; the feature it powers is disabled`,
	);

	return { ok: missing.length === 0, missing, warnings };
}
