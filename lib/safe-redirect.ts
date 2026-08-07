/**
 * Single source of truth for validating a user-supplied `callbackUrl`.
 *
 * The old check was `callbackUrl.startsWith('/')`, repeated at six call sites. It looks like an
 * same-origin test and is not one:
 *
 *   new URL('//evil.com',  'https://sharecircle.app/login')  ->  https://evil.com/
 *   new URL('/\\evil.com', 'https://sharecircle.app/login')  ->  https://evil.com/
 *
 * Both pass `startsWith('/')`. In `middleware.ts` that produced a first-party server-side 307 to
 * an attacker's origin — which survives the link scanners and mail gateways that would flag a raw
 * external link. On the client, where the value reaches `window.location.href`, a `javascript:`
 * scheme additionally executes on our own origin after a successful login.
 *
 * Anything not provably a same-origin path returns the fallback rather than throwing, because
 * every caller's correct behaviour on a bad value is "send them home", not "show an error".
 */

export const DEFAULT_REDIRECT = '/home';

export function safeRedirectPath(raw: string | null | undefined, fallback: string = DEFAULT_REDIRECT): string {
	if (!raw) return fallback;

	// Must be an absolute path on this origin.
	if (!raw.startsWith('/')) return fallback;

	// Protocol-relative (`//host`) and its backslash variant (`/\host`, which WHATWG treats as
	// equivalent to `//host`) both start with '/' and both resolve off-origin.
	if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback;

	// Browsers strip tabs, newlines and other C0 controls from URLs before parsing, so
	// `/\t/evil.com` can smuggle past a check that runs on the raw string. Reject rather than
	// attempt to normalise — no legitimate callbackUrl contains a control character.
	// eslint-disable-next-line no-control-regex
	if (/[\u0000-\u001F\u007F]/.test(raw)) return fallback;

	return raw;
}
