-- Performance hot-path indexes
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX IF NOT EXISTS items_embedding_hnsw_idx
  ON items
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "items_archived_at_created_at_idx"
  ON "items" ("archived_at", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "borrow_requests_owner_status_created_idx"
  ON "borrow_requests" ("owner_id", "status", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "borrow_requests_requester_status_created_idx"
  ON "borrow_requests" ("requester_id", "status", "created_at" DESC);
