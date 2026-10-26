-- The users who have signed in. Auth0 stays the identity provider (passwords, login, roles); this
-- table holds what the app itself needs to know about a user. A row is created on the user's first
-- request (UserProvisioningFilter), with name and email taken from the access token.
-- `users`, not `user`: USER is a reserved word in PostgreSQL.
CREATE TABLE users (
    id         VARCHAR(255) PRIMARY KEY,
    name       VARCHAR(255),
    email      VARCHAR(320),
    blocked    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Admin list of users, newest first
CREATE INDEX users_created_idx ON users (created_at DESC, id DESC);

-- Everyone who already owns a todo becomes a user (without name and email, until their next request)
INSERT INTO users (id) SELECT DISTINCT owner_id FROM todo;

-- From now on a todo can only belong to an existing user. todo_owner_created_idx (V2) starts with
-- owner_id, so it also serves this foreign key.
ALTER TABLE todo ADD CONSTRAINT todo_owner_fk FOREIGN KEY (owner_id) REFERENCES users (id);
