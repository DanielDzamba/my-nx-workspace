-- Transactional outbox: an event is written in the same transaction as the change that caused it,
-- so either both are committed or neither. OutboxRelay sends the unpublished rows to RabbitMQ and
-- then sets published_at. Writing to the database and sending to the broker directly would be two
-- systems without a shared transaction ("dual write"): a crash in between loses the event.
CREATE TABLE outbox_event (
    id             UUID         PRIMARY KEY,
    aggregate_type VARCHAR(50)  NOT NULL,
    aggregate_id   VARCHAR(50)  NOT NULL,
    event_type     VARCHAR(100) NOT NULL,
    payload        JSONB        NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    published_at   TIMESTAMPTZ
);

-- The relay only ever asks for the unpublished rows, oldest first; a partial index keeps that
-- query fast however many published rows pile up.
CREATE INDEX outbox_event_unpublished_idx ON outbox_event (created_at) WHERE published_at IS NULL;

-- Written by the TodoCompleted consumer. No foreign key to todo: a notification outlives the todo,
-- so it keeps the title it had when the event happened.
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
