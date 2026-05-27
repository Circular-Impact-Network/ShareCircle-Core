-- Performance hot-path indexes
-- Adds:
--   1. HNSW index on items.embedding (vector_cosine_ops) — turns O(n) semantic search into O(log n)
--   2. Composite indexes on hot ORDER BY queries

-- pgvector should already be enabled by the baseline migration; safety-check
CREATE EXTENSION IF NOT EXISTS vector;

-- HNSW index for cosine similarity on the multimodal embedding column.
-- m=16, ef_construction=64 are the pgvector defaults and balance build time vs. recall.
CREATE INDEX IF NOT EXISTS items_embedding_hnsw_idx
  ON items
  USING hnsw (embedding vector_cosine_ops);

-- Item: dashboard / browse "recent active items" hot query.
-- Filters by archivedAt IS NULL, orders by createdAt DESC.
CREATE INDEX IF NOT EXISTS "items_archived_at_created_at_idx"
  ON "items" ("archived_at", "created_at" DESC);

-- BorrowRequest: dashboard "incoming pending" + "my outgoing" queries always filter by status and order by createdAt.
CREATE INDEX IF NOT EXISTS "borrow_requests_owner_status_created_idx"
  ON "borrow_requests" ("owner_id", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "borrow_requests_requester_status_created_idx"
  ON "borrow_requests" ("requester_id", "status", "created_at" DESC);

-- Notification: per-type filtered tab queries (e.g. only NEW_MESSAGE, only borrow types) — composite avoids partial scan.
CREATE INDEX IF NOT EXISTS "notifications_user_type_status_idx"
  ON "notifications" ("user_id", "type", "status");
