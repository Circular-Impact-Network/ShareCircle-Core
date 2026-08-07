import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Singleton: reuse a single Supabase client (and WebSocket connection) across all hooks
let browserClient: SupabaseClient | null = null;

/** Refresh a token this long before it actually expires. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;

/**
 * After a failed token fetch, refuse further attempts for this long.
 *
 * Without it, a persistently failing endpoint (a missing SUPABASE_JWT_SECRET, say) turned every
 * page load into a burst of doomed requests — there are several subscribers per authenticated
 * page, and the socket asks for a token again on every reconnect.
 */
const AUTH_RETRY_COOLDOWN_MS = 30_000;

let cachedToken: { token: string; expiresAt: number } | null = null;
let inFlight: Promise<string> | null = null;
let authRetryBlockedUntil = 0;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const subscriptionFailures = new Map<string, number>();

/** For use in tests only — resets the singleton so each test gets a fresh client. */
export function resetBrowserSupabaseClient() {
	browserClient = null;
	cachedToken = null;
	inFlight = null;
	authRetryBlockedUntil = 0;
	subscriptionFailures.clear();
	if (refreshTimer) {
		clearTimeout(refreshTimer);
		refreshTimer = null;
	}
}

async function fetchRealtimeToken(): Promise<string> {
	const res = await fetch('/api/realtime/token', { credentials: 'same-origin' });
	if (!res.ok) {
		throw new Error(`Realtime token request failed: ${res.status}`);
	}
	const { token, expiresAt } = (await res.json()) as { token: string; expiresAt: number };
	cachedToken = { token, expiresAt };
	scheduleRefresh(expiresAt);
	return token;
}

/**
 * The token provider handed to supabase-js.
 *
 * This must be the *only* way a token reaches the socket. supabase-js calls it on client
 * construction and again inside `RealtimeClient.connect()` — which means on every reconnect —
 * and whatever it returns is pushed to all joined channels as an `access_token` event.
 *
 * It deliberately throws rather than returning anything on failure. The one thing it must never
 * do is hand back the anon key: our policies on `realtime.messages` are granted `TO authenticated`,
 * so an anon token gets every private channel refused. A throw leaves the previous good token in
 * place; a fallback silently kills live updates until the page is reloaded.
 */
async function getRealtimeAccessToken(): Promise<string> {
	if (cachedToken && cachedToken.expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
		return cachedToken.token;
	}
	if (inFlight) return inFlight;

	if (Date.now() < authRetryBlockedUntil) {
		throw new Error('Realtime authorisation is cooling down after a recent failure');
	}

	inFlight = fetchRealtimeToken()
		.catch(error => {
			authRetryBlockedUntil = Date.now() + AUTH_RETRY_COOLDOWN_MS;
			throw error;
		})
		.finally(() => {
			inFlight = null;
		});

	return inFlight;
}

/**
 * Rotate before expiry on a socket that stays connected.
 *
 * `setAuth()` with no argument routes back through the provider above, so the refreshed token is
 * pushed to every joined channel and an established subscription survives the rotation.
 */
function scheduleRefresh(expiresAt: number) {
	if (refreshTimer) clearTimeout(refreshTimer);
	const delay = Math.max(30_000, expiresAt - Date.now() - TOKEN_REFRESH_MARGIN_MS);
	refreshTimer = setTimeout(() => {
		void browserClient?.realtime.setAuth().catch(error => {
			console.error('Failed to refresh realtime token:', error);
		});
	}, delay);
}

export function createBrowserSupabaseClient() {
	if (typeof window === 'undefined' || !supabaseUrl || !supabaseAnonKey) {
		return null;
	}

	if (!browserClient) {
		// `accessToken` puts us in charge of the socket's JWT. Without it supabase-js wires its own
		// GoTrue session in as the provider, and because this app authenticates with NextAuth there
		// is never a GoTrue session — so it resolved to the anon key and overwrote our token inside
		// `connect()`. The first connect usually won the race, but the first reconnect did not:
		// channels rejoined as `anon`, every private topic was refused, and live messages and
		// notifications stopped arriving until the page was reloaded.
		//
		// Setting this option also makes `supabaseClient.auth` throw on access. Nothing here uses
		// it; NextAuth owns authentication.
		browserClient = createClient(supabaseUrl, supabaseAnonKey, {
			accessToken: getRealtimeAccessToken,
		});
	}
	return browserClient;
}

/**
 * Warms the token before a private channel is joined.
 *
 * Every channel in this app is created with `config: { private: true }`, which means Supabase
 * evaluates the RLS policies on `realtime.messages` against the JWT on the socket. Callers await
 * this so that a token failure surfaces as a logged error at the subscription site rather than as
 * a channel that silently receives nothing.
 *
 * Correctness no longer depends on it — `connect()` awaits the provider before flushing any join —
 * but the ordering keeps failures diagnosable.
 */
export function ensureRealtimeAuth(_client: SupabaseClient): Promise<void> {
	return getRealtimeAccessToken().then(() => undefined);
}

/**
 * Status callback for `channel.subscribe()`.
 *
 * Subscribing without one swallows `CHANNEL_ERROR` entirely, which is how a socket that was being
 * refused every private topic looked identical to a healthy one: no console output, no failed
 * request, just updates that never arrived. Always pass this.
 *
 * The first failure on a topic is expected and is logged as a warning, not an error: Supabase
 * refuses the first private join while the tenant's database connection is still being
 * established, and Phoenix rejoins about two seconds later. Only a topic that keeps failing
 * indicates a real problem, so that is what gets escalated — otherwise every page load opens with
 * a screenful of red and the signal is lost again.
 */
export function reportSubscription(topic: string) {
	return (status: string, error?: Error) => {
		if (status === 'SUBSCRIBED') {
			subscriptionFailures.delete(topic);
			return;
		}
		if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT') return;

		const failures = (subscriptionFailures.get(topic) ?? 0) + 1;
		subscriptionFailures.set(topic, failures);
		const detail = error?.message ?? 'no detail supplied';

		if (failures === 1) {
			console.warn(`Realtime channel "${topic}" ${status} on first join (${detail}); retrying.`);
		} else {
			console.error(`Realtime channel "${topic}" ${status} ${failures} times: ${detail}`);
		}
	};
}
