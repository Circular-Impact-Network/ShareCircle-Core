-- Search Items Function for Hybrid Search (Vector Similarity + Full-Text)
-- This script creates the search_items PostgreSQL function required for semantic search
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Ensure items table has an embedding column
ALTER TABLE items
    ADD COLUMN IF NOT EXISTS embedding vector(1024);

-- Drop the old IVFFlat index if it exists (less accurate for small/medium datasets)
DROP INDEX IF EXISTS items_embedding_idx;

-- Create HNSW index for more accurate nearest-neighbor search at any scale
CREATE INDEX IF NOT EXISTS items_embedding_hnsw_idx
    ON items USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Add a tsvector column for full-text search combining name, description, categories, and tags
-- This enables hybrid search (vector similarity + text matching)
ALTER TABLE items
    ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate the search_vector column for existing rows
UPDATE items SET search_vector = (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(categories, ' '), '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'B')
);

-- Create a GIN index on the tsvector column for fast full-text search
CREATE INDEX IF NOT EXISTS items_search_vector_idx
    ON items USING gin (search_vector);

-- Create a trigger function to automatically update search_vector on insert/update
CREATE OR REPLACE FUNCTION items_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(array_to_string(NEW.categories, ' '), '')), 'A') ||
        setweight(to_tsvector('english', coalesce(array_to_string(NEW.tags, ' '), '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists, then recreate
DROP TRIGGER IF EXISTS items_search_vector_trigger ON items;
CREATE TRIGGER items_search_vector_trigger
    BEFORE INSERT OR UPDATE OF name, description, categories, tags
    ON items
    FOR EACH ROW
    EXECUTE FUNCTION items_search_vector_update();

-- Drop old function signature to avoid conflicts
DROP FUNCTION IF EXISTS search_items(vector(1024), text[], text, text, float, int);

-- Create or replace the search_items function with hybrid search
-- Combines vector similarity (cosine) with full-text search (tsvector) for better results
CREATE OR REPLACE FUNCTION search_items(
    query_embedding vector(1024),
    query_text text,
    circle_ids text[],
    category_filter text,
    tag_filter text,
    similarity_threshold float,
    result_limit int
)
RETURNS TABLE (
    id text,
    name text,
    description text,
    image_path text,
    categories text[],
    tags text[],
    owner_id text,
    created_at timestamp,
    similarity float
) AS $$
DECLARE
    tsquery_val tsquery;
BEGIN
    -- Build tsquery from the query text (if provided)
    -- Use plainto_tsquery for natural language input, websearch_to_tsquery for better handling
    IF query_text IS NOT NULL AND query_text != '' THEN
        tsquery_val := websearch_to_tsquery('english', query_text);
    ELSE
        tsquery_val := NULL;
    END IF;

    RETURN QUERY
    SELECT 
        i.id,
        i.name,
        i.description,
        i.image_path,
        i.categories,
        i.tags,
        i.owner_id,
        i.created_at,
        -- Hybrid score: combine vector similarity with text relevance
        -- When text matches exist, boost the score; otherwise rely on vector similarity alone
        CASE
            WHEN tsquery_val IS NOT NULL AND i.search_vector @@ tsquery_val THEN
                -- Weighted combination: 60% vector similarity + 40% text relevance (normalized)
                (0.6 * (1 - (i.embedding <=> query_embedding)) +
                 0.4 * LEAST(ts_rank_cd(i.search_vector, tsquery_val, 32) * 10, 1.0))::float
            ELSE
                -- No text match: use pure vector similarity
                (1 - (i.embedding <=> query_embedding))::float
        END as similarity
    FROM items i
    INNER JOIN item_circles ic ON i.id = ic.item_id
    WHERE 
        ic.circle_id = ANY(circle_ids)
        AND i.embedding IS NOT NULL
        AND (category_filter IS NULL OR category_filter = ANY(i.categories))
        AND (tag_filter IS NULL OR tag_filter = ANY(i.tags))
        AND (
            -- Pass if vector similarity meets threshold OR text matches
            (1 - (i.embedding <=> query_embedding)) >= similarity_threshold
            OR (tsquery_val IS NOT NULL AND i.search_vector @@ tsquery_val)
        )
    GROUP BY i.id, i.name, i.description, i.image_path, i.categories, i.tags, i.owner_id, i.created_at, i.embedding, i.search_vector
    ORDER BY similarity DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Fix mutable search_path security warnings
ALTER FUNCTION search_items(vector(1024), text, text[], text, text, float, int) SET search_path = public;
ALTER FUNCTION items_search_vector_update() SET search_path = public;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_items(vector(1024), text, text[], text, text, float, int) TO authenticated;
GRANT EXECUTE ON FUNCTION search_items(vector(1024), text, text[], text, text, float, int) TO service_role;

-- Verify the function was created
SELECT 'search_items function with hybrid search created successfully!' as status;
