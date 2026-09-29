-- A todo can be split into subtasks (1:N). Deleting a todo deletes its subtasks in the database
-- (ON DELETE CASCADE), so Hibernate does not have to load and delete them one by one.
CREATE TABLE subtask (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    todo_id    BIGINT       NOT NULL REFERENCES todo (id) ON DELETE CASCADE,
    title      VARCHAR(200) NOT NULL,
    completed  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- PostgreSQL does not index foreign keys automatically. Without this index, loading the subtasks
-- of one todo (and the cascade delete) would scan the whole subtask table.
CREATE INDEX subtask_todo_created_idx ON subtask (todo_id, created_at, id);
