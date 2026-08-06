import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Singleton: reuse a single Supabase client (and WebSocket connection) across all hooks
let browserClient: SupabaseClient | null = null;

/**
 * Shared across every hook, because the token belongs to the socket rather than to any one
 * channel. The first subscriber pays for the fetch; the rest await the same promise.
 */
let realtimeAuth: Promise<void> | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

/** For use in tests only — resets the singleton so each test gets a fresh client. */
export function resetBrowserSupabaseClient() {
	browserClient = null;
	realtimeAuth = null;
	if (refreshTimer) {
		clearTimeout(refreshTimer);
		refreshTimer = null;
	}
}

export function createBrowserSupabaseClient() {
	if (typeof window === 'undefined' || !supabaseUrl || !supabaseAnonKey) {
		return null;
	}

	if (!browserClient) {
		browserClient = createClient(supabaseUrl, supabaseAnonKey, {
			auth: {
				persistSession: false,
				autoRefreshToken: false,
			},
		});
	}
	return browserClient;
}

async function applyRealtimeToken(client: SupabaseClient): Promise<void> {
	const res = await fetch('/api/realtime/token', { credentials: 'same-origin' });
	if (!res.ok) {
		throw new Error(`Realtime token request failed: ${res.status}`);
	}
	const { token, expiresAt } = (await res.json()) as { token: string; expiresAt: number };

	await client.realtime.setAuth(token);

	// Renew a few minutes before expiry. setAuth on a live socket pushes the new token to the
	// server, so an established subscription survives the rotation.
	const msUntilRefresh = Math.max(30_000, expiresAt - Date.now() - 5 * 60_000);
	if (refreshTimer) clearTimeout(refreshTimer);
	refreshTimer = setTimeout(() => {
		realtimeAuth = applyRealtimeToken(client).catch(error => {
			console.error('Failed to refresh realtime token:', error);
			// Clear so the next subscriber retries rather than awaiting a permanently rejected promise.
			realtimeAuth = null;
		});
	}, msUntilRefresh);
}

/**
 * Authorises the socket before any private channel is joined.
 *
 * Every channel in this app is created with `config: { private: true }`, which means Supabase
 * evaluates the RLS policies on `realtime.messages` against the JWT attached to the socket. Until
 * `setAuth` has run there is no JWT, so a join is refused — hence every subscriber awaits this
 * first.
 *
 * Failure is deliberately propagated rather than swallowed. A hook that silently carried on would
 * simply not receive events, which is far harder to diagnose than an error, and there is no safe
 * fallback: the previous behaviour — public channels — is the vulnerability being closed.
 */
export function ensureRealtimeAuth(client: SupabaseClient): Promise<void> {
	if (!realtimeAuth) {
		realtimeAuth = applyRealtimeToken(client).catch(error => {
			realtimeAuth = null; // allow a later subscriber to retry
			throw error;
		});
	}
	return realtimeAuth;
}
