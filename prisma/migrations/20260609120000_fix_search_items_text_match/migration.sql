-- Fix: hybrid search dropped every item without an embedding.
--
-- The previous search_items() filtered `i.embedding IS NOT NULL`, so the
-- "OR text matches" branch was unreachable for items whose embedding had not
-- been generated yet (embeddings are produced asynchronously after item create).
-- Result: a plain name search returned nothing for freshly-created items.
--
-- This replaces the function so a row qualifies when EITHER the vector similarity
-- meets the threshold OR the full-text vector matches the query — and it scores
-- text-only matches (NULL embedding) on text relevance alone instead of excluding
-- them. Pure SQL function replacement; no schema/table change.

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
        CASE
            -- Both a text match AND an embedding: weighted hybrid score.
            WHEN tsquery_val IS NOT NULL AND i.search_vector @@ tsquery_val AND i.embedding IS NOT NULL THEN
                (0.6 * (1 - (i.embedding <=> query_embedding)) +
                 0.4 * LEAST(ts_rank_cd(i.search_vector, tsquery_val, 32) * 10, 1.0))::float
            -- Text match but no embedding yet: text relevance only (so it still ranks).
            WHEN tsquery_val IS NOT NULL AND i.search_vector @@ tsquery_val THEN
                LEAST(ts_rank_cd(i.search_vector, tsquery_val, 32) * 10, 1.0)::float
            -- No text match but has an embedding: pure vector similarity.
            WHEN i.embedding IS NOT NULL THEN
                (1 - (i.embedding <=> query_embedding))::float
            ELSE
                0::float
        END as similarity
    FROM items i
    INNER JOIN item_circles ic ON i.id = ic.item_id
    WHERE
        ic.circle_id = ANY(circle_ids)
        AND (category_filter IS NULL OR category_filter = ANY(i.categories))
        AND (tag_filter IS NULL OR tag_filter = ANY(i.tags))
        AND (
            -- Vector match (only when an embedding exists) OR full-text match.
            (i.embedding IS NOT NULL AND (1 - (i.embedding <=> query_embedding)) >= similarity_threshold)
            OR (tsquery_val IS NOT NULL AND i.search_vector @@ tsquery_val)
        )
    GROUP BY i.id, i.name, i.description, i.image_path, i.categories, i.tags, i.owner_id, i.created_at, i.embedding, i.search_vector
    ORDER BY similarity DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION search_items(vector(1024), text, text[], text, text, float, int) SET search_path = public;
