-- Units/currency/appearance per account. These lived only in localStorage, so a new device
-- silently reverted the user to kg + USD.
CREATE TABLE IF NOT EXISTS "user_display_preferences" (
    "user_id" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'light',
    "font_size" TEXT NOT NULL DEFAULT 'md',
    "weight_unit" TEXT NOT NULL DEFAULT 'kg',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_display_preferences_pkey" PRIMARY KEY ("user_id")
);

-- Guided-tour completion, per account rather than per browser.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tour_completed_at" TIMESTAMP(3);

-- Help-bot usage, for a quota that survives a deploy (the in-memory limiter does not).
CREATE TABLE IF NOT EXISTS "ai_usages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "refused" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_usages_user_id_created_at_idx" ON "ai_usages"("user_id", "created_at");

-- Guarded so re-running against a database that already has them cannot fail the deploy.
DO $$
BEGIN
    ALTER TABLE "user_display_preferences"
        ADD CONSTRAINT "user_display_preferences_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TABLE "ai_usages"
        ADD CONSTRAINT "ai_usages_user_id_fkey"
        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
