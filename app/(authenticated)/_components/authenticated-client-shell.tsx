'use client';

import { useUserSync } from '@/hooks/useUserSync';

// Pure side-effect island: keeps Redux user state synced with the session.
// Rendered alongside the server-rendered authenticated layout so we don't
// block the entire route tree on a client-side useSession() round-trip.
export function AuthenticatedClientShell() {
	useUserSync();
	return null;
}
