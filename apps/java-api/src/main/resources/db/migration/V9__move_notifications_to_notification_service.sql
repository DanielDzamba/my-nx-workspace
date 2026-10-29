-- Notifications moved to notification-service, which has its own database. The old rows are not
-- migrated (decided: the new service starts empty).
DROP TABLE notification;

-- The outbox now also carries user events, whose aggregate ID is the Auth0 user ID: as long as
-- users.id, not just a todo ID
ALTER TABLE outbox_event ALTER COLUMN aggregate_id TYPE VARCHAR(255);

-- notification-service learns about blocking only from events, so it would not know the users that
-- were blocked before it existed. Send one user.blocked per blocked user (same JSON as
-- UserBlockedEvent); the relay publishes them like any other event. A consumer that already knows
-- the status just keeps it.
INSERT INTO outbox_event (id, aggregate_type, aggregate_id, event_type, payload)
SELECT gen_random_uuid(), 'User', id, 'user.blocked',
       jsonb_build_object('userId', id,
                          'occurredAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))
FROM users
WHERE blocked;
