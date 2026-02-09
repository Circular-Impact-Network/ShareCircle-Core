-- Add invite expiry to circles
ALTER TABLE "circles"
ADD COLUMN "invite_expires_at" TIMESTAMP(3) NOT NULL DEFAULT (now() + interval '7 days');
