-- Optimistic locking: Hibernate increments `version` on every update of a todo (@Version on Todo),
-- and the client sends back the version it edited, so a change based on an outdated todo is
-- rejected with 409 instead of silently overwriting a newer one (lost update).
-- The DEFAULT fills the existing rows (they start at 0) in the same statement, so NOT NULL is safe.
ALTER TABLE todo ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
