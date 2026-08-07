/**
 * Ownership rules for Supabase Storage object keys.
 *
 * `uploadImage` in lib/supabase.ts always writes to `${userId}/${Date.now()}.${ext}`, so the first
 * path segment is the owning user's id. `app/api/items/cleanup/route.ts` already relied on that to
 * refuse deleting other people's files — but the item create and update routes accepted
 * `imagePath` and `mediaPaths` as bare strings.
 *
 * That gap was exploitable in both directions, because signing and deletion both run with the
 * service-role key and bypass RLS:
 *
 *  - read:   set `imagePath` to a path read out of someone else's item, and the API signs it for you
 *  - delete: set `mediaPaths` to a victim's path, then clear it — the update handler treats the
 *            difference as "media the owner removed" and deletes the object permanently
 *
 * Centralised here so the rule has one definition rather than being restated per route, which is
 * how the cleanup route ended up as the only place that had it.
 */

/** True when `path` lives under the user's own storage prefix. */
export function isOwnedStoragePath(path: string, userId: string): boolean {
	if (!path || !userId) return false;
	// Reject traversal outright rather than trying to normalise it — no legitimate key contains it.
	if (path.includes('..')) return false;
	return path.startsWith(`${userId}/`);
}

/**
 * Returns the subset of `paths` the user does not own. Empty array means everything checks out,
 * which lets callers write `if (foreign.length) return 403`.
 */
export function findForeignStoragePaths(paths: ReadonlyArray<string | null | undefined>, userId: string): string[] {
	return paths
		.filter((p): p is string => typeof p === 'string' && p.length > 0)
		.filter(p => !isOwnedStoragePath(p, userId));
}
