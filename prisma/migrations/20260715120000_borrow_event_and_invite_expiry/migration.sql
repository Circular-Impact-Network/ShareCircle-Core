-- Batch #2 additive schema changes.
--
-- 1) Optional "event"/occasion free-text on borrow requests and the transactions
--    they spawn (e.g. "Wedding", "Camping trip"). Nullable, no backfill needed.
-- 2) Extend the invite-link expiry default from 7 to 30 days so shared links stay
--    valid long enough to actually be used. Only affects rows created after this runs.
--
-- Idempotent (IF NOT EXISTS) so it is safe to apply on databases where the columns
-- were already added out-of-band.

ALTER TABLE "borrow_requests" ADD COLUMN IF NOT EXISTS "event" TEXT;
ALTER TABLE "borrow_transactions" ADD COLUMN IF NOT EXISTS "event" TEXT;

ALTER TABLE "circles" ALTER COLUMN "invite_expires_at" SET DEFAULT (now() + interval '30 days');
