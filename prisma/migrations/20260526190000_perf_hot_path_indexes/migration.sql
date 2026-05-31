-- Performance hot-path indexes
CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX IF NOT EXISTS items_embedding_hnsw_idx
  ON items
  USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS "items_archived_at_created_at_idx"
  ON "items" ("archived_at", "created_at" DESC);
