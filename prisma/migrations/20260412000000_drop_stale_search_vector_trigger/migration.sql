-- Drop stale full-text search trigger and function from items table.
-- The search_vector column was removed when pgvector embeddings replaced full-text search,
-- but this trigger was never cleaned up. It fires on INSERT/UPDATE and tries to set
-- NEW.search_vector, which no longer exists — causing P2022 on every item create/update.

DROP TRIGGER IF EXISTS items_search_vector_trigger ON public.items;
DROP FUNCTION IF EXISTS public.items_search_vector_update();
