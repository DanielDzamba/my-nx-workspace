-- Todos from before login existed (owner_id 'legacy', see V2) belong to no real user and are no
-- longer needed. A new migration deletes them: V2 has already run on every database, and Flyway
-- refuses to start when an applied migration is changed (checksum mismatch).
-- Their subtasks are deleted by the database (ON DELETE CASCADE in V3).
DELETE FROM todo WHERE owner_id = 'legacy';
