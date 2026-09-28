-- Every todo belongs to one user: owner_id is the `sub` claim of the Auth0 access token
-- (e.g. `auth0|64f1...` or `google-oauth2|1057...`).
--
-- The table already has rows, so NOT NULL cannot be added in one step:
-- 1. add the column as nullable, 2. backfill the existing rows, 3. make it NOT NULL.
-- Flyway runs the whole migration in one transaction (PostgreSQL has transactional DDL),
-- so a failure in any step rolls back all of them.

ALTER TABLE todo ADD COLUMN owner_id VARCHAR(255);

-- Todos created before login existed belong to nobody: only an admin sees them
UPDATE todo SET owner_id = 'legacy' WHERE owner_id IS NULL;

ALTER TABLE todo ALTER COLUMN owner_id SET NOT NULL;

-- Every user request filters by owner and sorts by creation time
CREATE INDEX todo_owner_created_idx ON todo (owner_id, created_at, id);
