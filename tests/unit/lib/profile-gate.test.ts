import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Requirement (2026-08-05): "Since age and location is not optional. Add a thing in the app like
 * a middleware or something that if someone has not filled it due to any reason (it is optional
 * till now, or it got skipped etc) and tries to login, it should not allow to move forward
 * without filling the required details."
 *
 * `lib/auth.ts` cannot be imported here — it pulls in the Prisma client and the NextAuth
 * adapter. These assertions are on source structure instead, which is enough to catch the two
 * ways this silently regresses: the invariant narrowing back to date-of-birth only, and the
 * cache-busting version stamp being dropped.
 */
const authSource = readFileSync(resolve(process.cwd(), 'lib/auth.ts'), 'utf8');
const middlewareSource = readFileSync(resolve(process.cwd(), 'middleware.ts'), 'utf8');

describe('profile completion invariant', () => {
	it('requires both date of birth and a non-blank city', () => {
		const fn = authSource.match(/function isProfileComplete[\s\S]*?\n}/)?.[0] ?? '';
		expect(fn).toContain('date_of_birth');
		// The 2026-08-05 bug: location became mandatory at signup while this still only
		// checked date_of_birth, so incomplete accounts sailed past the gate.
		expect(fn).toContain('city');
		// Whitespace-only city must not count as a location.
		expect(fn).toMatch(/city\?\.trim\(\)/);
	});

	it('selects city from the database, or the invariant can never see it', () => {
		const select = authSource.match(/select:\s*\{[^}]*emailVerified[^}]*\}/)?.[0] ?? '';
		expect(select).toContain('date_of_birth');
		expect(select).toContain('city');
	});

	it('computes profileComplete through the shared invariant, not inline', () => {
		expect(authSource).toMatch(/token\.profileComplete = isProfileComplete\(dbUser\)/);
		// A second inline definition is how the two ends drift apart.
		expect(authSource).not.toMatch(/profileComplete = dbUser\.date_of_birth != null/);
	});
});

describe('JWT cache busting', () => {
	/**
	 * profileComplete is cached in the token and was only refreshed when absent. Widening the
	 * rule without a version stamp would leave every existing user — dob set, city null —
	 * reading profileComplete: true until their next sign-in.
	 */
	it('declares a rule version and re-reads when the token predates it', () => {
		expect(authSource).toMatch(/const PROFILE_RULE_VERSION = \d+/);
		expect(authSource).toContain('token.profileRuleVersion !== PROFILE_RULE_VERSION');
	});

	it('stamps the version onto the token after a successful read', () => {
		expect(authSource).toContain('token.profileRuleVersion = PROFILE_RULE_VERSION');
	});

	it('is at version 2 or higher, since version 1 was date-of-birth only', () => {
		const version = Number(authSource.match(/const PROFILE_RULE_VERSION = (\d+)/)?.[1]);
		expect(version).toBeGreaterThanOrEqual(2);
	});
});

describe('middleware gate', () => {
	it('redirects incomplete profiles away from protected routes', () => {
		expect(middlewareSource).toContain('token.profileComplete === false');
		expect(middlewareSource).toContain('/complete-profile');
	});

	it('guards the invite landing page', () => {
		// /join joins a circle on mount. Left unguarded it was a route to circle membership
		// with no age or location on file.
		expect(middlewareSource).toMatch(/\/\^\\\/join\$\//);
	});

	it('preserves the query string in callbackUrl', () => {
		// A bare pathname dropped ?code= from /join, so anyone bounced through login or profile
		// completion lost the invite they had clicked.
		expect(middlewareSource).toContain('request.nextUrl.search');
		expect(middlewareSource).not.toMatch(/setQ?\(\s*'callbackUrl',\s*pathname\s*\)/);
	});
});
