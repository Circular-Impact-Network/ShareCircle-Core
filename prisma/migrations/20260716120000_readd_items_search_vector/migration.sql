-- Restore items.search_vector as a GENERATED tsvector column.
--
-- Background: 20260412000000_drop_stale_search_vector_trigger removed the old
-- trigger-maintained search_vector column (its trigger was firing on a column that
-- had been dropped). Later, 20260609120000_fix_search_items_text_match reintroduced
-- references to i.search_vector inside search_items() for hybrid text+vector ranking —
-- but the column no longer existed, so every call to search_items() errors with
-- "column i.search_vector does not exist" and the app silently falls back to plain
-- text search (semantic/vector search never runs).
--
-- Fix: recreate search_vector as a STORED GENERATED column so search_items() works as
-- designed. Postgres requires the generation expression to be IMMUTABLE; the multi-arg
-- to_tsvector/array_to_string composition trips the planner's immutability check, so we
-- wrap it in an explicitly IMMUTABLE helper (the expression genuinely is immutable —
-- to_tsvector with a constant regconfig is immutable). Trigger-free and auto-maintained.

CREATE OR REPLACE FUNCTION public.items_search_document(
	name text,
	description text,
	tags text[],
	categories text[]
) RETURNS tsvector
	LANGUAGE sql
	IMMUTABLE
	PARALLEL SAFE
AS $$
	SELECT to_tsvector(
		'english'::regconfig,
		coalesce(name, '') || ' ' ||
		coalesce(description, '') || ' ' ||
		coalesce(array_to_string(tags, ' '), '') || ' ' ||
		coalesce(array_to_string(categories, ' '), '')
	);
$$;

ALTER TABLE public.items
	ADD COLUMN IF NOT EXISTS search_vector tsvector
	GENERATED ALWAYS AS (public.items_search_document(name, description, tags, categories)) STORED;

CREATE INDEX IF NOT EXISTS items_search_vector_gin_idx ON public.items USING gin (search_vector);
