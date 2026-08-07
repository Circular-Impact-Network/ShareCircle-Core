-- Stamp of the last password change or reset, used to revoke JWT sessions minted before it.
--
-- Nullable and left NULL for existing rows on purpose: a NULL reads as "never changed", so no
-- currently signed-in user is logged out by this migration. The first password change on an
-- account sets the stamp and, from that point, ends every other session for it.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMP(3);
