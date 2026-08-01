-- Circle names must be unique per creator.
--
-- A user seeing two circles called "Family" in their own list has no way to tell them
-- apart. Scoped to the creator, so two different users may each have a "Family".
--
-- Case- and whitespace-insensitive, which needs a functional index — Prisma's @@unique
-- cannot express lower(btrim(...)), so this index lives only in SQL. `prisma db push`
-- would drop it; use migrations for this table.
--
-- Verified before writing: 0 per-creator duplicate names across 2227 dev circles, so this
-- applies without a backfill. If it ever fails on another environment, find the offenders
-- with:
--   SELECT created_by, lower(btrim(name)), count(*) FROM circles
--   GROUP BY 1, 2 HAVING count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "circles_created_by_name_key"
	ON "circles" ("created_by", lower(btrim("name")));
