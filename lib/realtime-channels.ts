/**
 * Every Realtime channel in this app is private.
 *
 * Supabase only evaluates the RLS policies on `realtime.messages` for channels created with
 * `config.private = true`. A public channel is joinable by anyone presenting the anon key, and
 * that key is in the client bundle by design — so with public channels the server's broadcasts,
 * message bodies included, were readable by anyone who knew a user id. User ids are handed out by
 * `GET /api/messages/threads` and `GET /api/circles/[id]/members`.
 *
 * Exported as one constant rather than written inline at each of the seventeen call sites, so
 * that "is this channel private?" has a single answer that cannot drift per file.
 */
export const PRIVATE_CHANNEL = { config: { private: true } } as const;
