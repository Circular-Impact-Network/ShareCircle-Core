import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Singleton: reuse a single Supabase client (and WebSocket connection) across all hooks
let browserClient: SupabaseClient | null = null;

/** For use in tests only — resets the singleton so each test gets a fresh client. */
export function resetBrowserSupabaseClient() {
	browserClient = null;
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
