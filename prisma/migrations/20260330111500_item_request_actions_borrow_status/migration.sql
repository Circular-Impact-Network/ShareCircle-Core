-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BorrowTransactionStatus" ADD VALUE 'LENDER_CONFIRMED';
ALTER TYPE "BorrowTransactionStatus" ADD VALUE 'BORROWER_CONFIRMED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ITEM_HANDOFF_CONFIRMED';
ALTER TYPE "NotificationType" ADD VALUE 'ITEM_RECEIVED_CONFIRMED';

-- CreateTable
CREATE TABLE "item_request_actions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "item_request_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_request_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_request_actions_user_id_idx" ON "item_request_actions"("user_id");

-- CreateIndex
CREATE INDEX "item_request_actions_item_request_id_idx" ON "item_request_actions"("item_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_request_actions_user_id_item_request_id_action_key" ON "item_request_actions"("user_id", "item_request_id", "action");

-- AddForeignKey
ALTER TABLE "item_request_actions" ADD CONSTRAINT "item_request_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_request_actions" ADD CONSTRAINT "item_request_actions_item_request_id_fkey" FOREIGN KEY ("item_request_id") REFERENCES "item_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
