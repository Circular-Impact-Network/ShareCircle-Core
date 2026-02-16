-- Create item_request_circles junction table for multi-circle item requests
CREATE TABLE "item_request_circles" (
    "id" TEXT NOT NULL,
    "item_request_id" TEXT NOT NULL,
    "circle_id" TEXT NOT NULL,
    "shared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "item_request_circles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "item_request_circles_item_request_id_circle_id_key"
ON "item_request_circles"("item_request_id", "circle_id");

CREATE INDEX "item_request_circles_circle_id_idx"
ON "item_request_circles"("circle_id");

CREATE INDEX "item_request_circles_item_request_id_idx"
ON "item_request_circles"("item_request_id");

ALTER TABLE "item_request_circles"
ADD CONSTRAINT "item_request_circles_item_request_id_fkey"
FOREIGN KEY ("item_request_id") REFERENCES "item_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "item_request_circles"
ADD CONSTRAINT "item_request_circles_circle_id_fkey"
FOREIGN KEY ("circle_id") REFERENCES "circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing one-circle-per-request data to the new junction table
INSERT INTO "item_request_circles" ("id", "item_request_id", "circle_id", "shared_at")
SELECT
    CONCAT('irc_', md5(ir.id || '-' || ir.circle_id)),
    ir.id,
    ir.circle_id,
    ir.created_at
FROM "item_requests" ir
WHERE ir.circle_id IS NOT NULL;

-- Remove old one-to-many column and index
DROP INDEX IF EXISTS "item_requests_circle_id_idx";
ALTER TABLE "item_requests" DROP COLUMN "circle_id";
