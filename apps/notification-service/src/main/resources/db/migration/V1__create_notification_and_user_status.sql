-- Written by the TodoCompleted consumer. Same table as java-api had (its V5), now in this
-- service's own database. No foreign key to todo, which lives in another database anyway: a
-- notification outlives the todo, so it keeps the title it had when the event happened.
CREATE TABLE notification (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- ID of the event that caused it. RabbitMQ delivers at least once, so the same event can arrive
    -- twice; the unique constraint makes the consumer idempotent (INSERT ... ON CONFLICT DO NOTHING).
    event_id     UUID         NOT NULL UNIQUE,
    recipient_id VARCHAR(255) NOT NULL,
    type         VARCHAR(50)  NOT NULL,
    todo_id      BIGINT       NOT NULL,
    todo_title   VARCHAR(200) NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    read_at      TIMESTAMPTZ
);

CREATE INDEX notification_recipient_created_idx ON notification (recipient_id, created_at DESC, id DESC);

-- Local copy of one fact owned by java-api: whether a user is blocked. Filled from the
-- user.blocked / user.unblocked events; a user without a row was never blocked. An unblocked user
-- keeps the row (blocked = false), so changed_at can reject an older event that arrives late.
CREATE TABLE user_status (
    user_id    VARCHAR(255) PRIMARY KEY,
    blocked    BOOLEAN      NOT NULL,
    changed_at TIMESTAMPTZ  NOT NULL
);
