/**
 * Whether a URL points at *our* Supabase storage.
 *
 * Four routes each carried their own copy of `hostname.endsWith('.supabase.co')`
 * (`items/analyze`, `items/detect`, `items/[id]` PATCH, `items` POST). That suffix admits **any**
 * Supabase project, so an attacker could register a free one and hand its URL to the vision call —
 * unbounded download into the model, and a prompt-injection sink whose output is written into a
 * listing. Pinning to the configured project closes it, and having one definition means the four
 * cannot drift apart the way the password and upload rules did.
 */

let cachedHostname: string | null | undefined;

/** The hostname of the configured Supabase project, or null if it is not configured. */
export function getSupabaseHostname(): string | null {
	if (cachedHostname !== undefined) return cachedHostname;

	const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
	if (!raw) {
		cachedHostname = null;
		return cachedHostname;
	}
	try {
		cachedHostname = new URL(raw).hostname;
	} catch {
		cachedHostname = null;
	}
	return cachedHostname;
}

/** For tests, which stub the environment between cases. */
export function resetSupabaseHostnameCache(): void {
	cachedHostname = undefined;
}

export type SupabaseUrlCheck = { ok: true } | { ok: false; reason: 'unconfigured' | 'invalid' };

/**
 * Deliberately distinguishes "the server has no Supabase URL configured" from "the caller sent a
 * URL we do not accept". Collapsing the two is how a misconfigured deployment ends up telling
 * every user their image is invalid.
 */
export function checkOwnSupabaseUrl(candidate: string): SupabaseUrlCheck {
	const allowedHost = getSupabaseHostname();
	if (!allowedHost) return { ok: false, reason: 'unconfigured' };

	try {
		return new URL(candidate).hostname === allowedHost ? { ok: true } : { ok: false, reason: 'invalid' };
	} catch {
		return { ok: false, reason: 'invalid' };
	}
}

/** Convenience for call sites that only need a boolean and treat unconfigured as "reject". */
export function isOwnSupabaseUrl(candidate: string): boolean {
	return checkOwnSupabaseUrl(candidate).ok;
}
