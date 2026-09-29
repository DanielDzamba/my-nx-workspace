-- Title search is `lower(title) LIKE '%milk%'`. A B-tree index only helps a LIKE with a fixed
-- prefix ('milk%'); with a leading % PostgreSQL has to read every row (Seq Scan).
-- pg_trgm splits text into trigrams ('mil', 'ilk', ...) and a GIN index over them can answer
-- LIKE '%...%'. The index is on the same expression the query uses (`lower(title)`),
-- otherwise the planner cannot use it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX todo_title_trgm_idx ON todo USING gin (lower(title) gin_trgm_ops);
