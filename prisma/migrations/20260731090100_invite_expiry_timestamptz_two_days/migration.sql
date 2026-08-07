-- Invite expiry: shorten to 2 days, and store it as an absolute instant.
--
-- Two separate problems with the old column:
--
-- 1. It was `timestamp(3) WITHOUT time zone` while its default was `now() + interval`.
--    `now()` is timestamptz, so the implicit cast into a naive column resolves through the
--    session TimeZone, and Prisma then reads the naive value back as if it were UTC. Any row
--    created outside the app (seed, Studio, raw INSERT) therefore got an expiry skewed by the
--    session offset — on an IST session, 5.5 hours off. Rows written by the app were
--    self-consistent, which is why this stayed latent.
--
-- 2. 30 days is far too long for a link that grants circle membership.
--
-- The USING clause interprets existing naive values as UTC, which is exactly how Prisma
-- wrote and read them, so no stored instant changes meaning.

ALTER TABLE "circles" ALTER COLUMN "invite_expires_at" DROP DEFAULT;

ALTER TABLE "circles"
	ALTER COLUMN "invite_expires_at" TYPE timestamptz(3)
	USING "invite_expires_at" AT TIME ZONE 'UTC';

ALTER TABLE "circles"
	ALTER COLUMN "invite_expires_at" SET DEFAULT (now() + interval '2 days');
