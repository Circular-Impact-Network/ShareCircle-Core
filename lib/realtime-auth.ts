import { SignJWT } from 'jose';

/**
 * Mints the short-lived Supabase-compatible JWT that lets a browser subscribe to *private*
 * Realtime channels.
 *
 * Why this exists: NextAuth is the identity provider here, but Supabase Realtime only enforces
 * authorization on private channels, and a channel is only private if the socket carries a JWT
 * this project's Supabase instance accepts. Without one, every channel was public — and a public
 * broadcast channel is readable by anyone holding the anon key, which ships in the client bundle.
 *
 * Signed with `SUPABASE_JWT_SECRET`, the project's **Legacy HS256 shared secret**. It has to be
 * the symmetric key: the asymmetric standby key's private half is held by Supabase and cannot be
 * used to sign here. Do not promote that standby key to current without first moving to Supabase
 * Third-Party Auth, or these tokens stop being accepted.
 *
 * The user id travels in a custom `app_user_id` claim rather than being read out of `sub` by
 * `auth.uid()`. Our ids are cuids (`users.id` is `text`), and `auth.uid()` casts `sub` to `uuid`,
 * which would raise on every check. The RLS policies read the custom claim instead — see
 * `public.can_access_realtime_topic`.
 */

export const REALTIME_TOKEN_TTL_SECONDS = 60 * 60;

/** Refresh this far before expiry so a renewal is never racing the socket being dropped. */
export const REALTIME_TOKEN_REFRESH_SKEW_SECONDS = 5 * 60;

export type RealtimeToken = {
	token: string;
	/** Unix epoch milliseconds, so the client can schedule its own refresh. */
	expiresAt: number;
};

export async function mintRealtimeToken(userId: string): Promise<RealtimeToken> {
	const secret = process.env.SUPABASE_JWT_SECRET;
	if (!secret) {
		// Loud rather than degrading to public channels: silently falling back would reinstate the
		// exact exposure this replaces.
		throw new Error(
			'SUPABASE_JWT_SECRET is not set. Realtime subscriptions cannot be authorised without it. ' +
				'Set it to the project\'s "Current key — Legacy HS256 (Shared Secret)" from ' +
				'Supabase Dashboard > Project Settings > API > JWT Settings. Each project has its own.',
		);
	}

	const issuedAt = Math.floor(Date.now() / 1000);
	const expiresAtSeconds = issuedAt + REALTIME_TOKEN_TTL_SECONDS;

	const token = await new SignJWT({ role: 'authenticated', app_user_id: userId })
		.setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
		.setSubject(userId)
		.setAudience('authenticated')
		.setIssuedAt(issuedAt)
		.setExpirationTime(expiresAtSeconds)
		.sign(new TextEncoder().encode(secret));

	return { token, expiresAt: expiresAtSeconds * 1000 };
}
