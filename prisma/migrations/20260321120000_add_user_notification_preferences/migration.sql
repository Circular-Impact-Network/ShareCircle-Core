-- CreateTable
CREATE TABLE "user_notification_preferences" (
    "user_id" TEXT NOT NULL,
    "global_in_app" BOOLEAN NOT NULL DEFAULT true,
    "global_push" BOOLEAN NOT NULL DEFAULT true,
    "category_overrides" JSONB NOT NULL DEFAULT '{}',
    "type_overrides" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
