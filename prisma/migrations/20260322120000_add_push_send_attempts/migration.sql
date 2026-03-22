-- CreateTable
CREATE TABLE "push_send_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "push_subscription_id" TEXT,
    "endpoint_host" VARCHAR(255) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "status_code" INTEGER,
    "error_message" TEXT,
    "error_body" TEXT,
    "payload_tag" VARCHAR(128),
    "purpose" VARCHAR(32) NOT NULL DEFAULT 'notification',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_send_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "push_send_attempts_user_id_created_at_idx" ON "push_send_attempts"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "push_send_attempts" ADD CONSTRAINT "push_send_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_send_attempts" ADD CONSTRAINT "push_send_attempts_push_subscription_id_fkey" FOREIGN KEY ("push_subscription_id") REFERENCES "push_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
