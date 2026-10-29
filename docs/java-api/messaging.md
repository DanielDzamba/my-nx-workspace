# Asynchronous messaging (java-api → notification-service)

Completing a todo notifies its owner. The notification is not created in the request that
completes the todo: java-api records a `TodoCompleted` event, and notification-service, a separate
app with its own database, turns it into a notification a moment later. This page explains the
parts and why each one exists.

```
java-api
  PUT /api/todos/5 {completed: true}
  TodoService.update ─┬─ UPDATE todo SET completed = true        ┐ one database
                      └─ INSERT INTO outbox_event (todo.completed) ┘ transaction
                                    │
  OutboxRelay (@Scheduled, every 1 s): SELECT ... FOR UPDATE SKIP LOCKED
                                    │  send + wait for the broker's confirm, then SET published_at
                                    ▼
RabbitMQ
  exchange todo.events (topic) ──"todo.completed"──► queue notification.todo-completed
                                                          │                  │ rejected
                                                          │                  ▼
                                                          │   todo.events.dlx ──► ...todo-completed.dlq
notification-service                                      ▼
  TodoCompletedListener (@RabbitListener)
    INSERT INTO notification ... ON CONFLICT (event_id) DO NOTHING   (its own database)
                                    │
  GET /api/notifications  ◄── the frontend polls it (bell in the app shell)
```

Blocking a user travels the same way: `UserService.setBlocked` records `user.blocked` /
`user.unblocked`, the relay publishes them to `user.events`, and notification-service keeps its own
copy of the status (`user_status`), so it rejects a blocked user without asking java-api.

Code in java-api: `messaging/` (exchanges, event records), `outbox/` (`Outbox`, `OutboxRelay`).
Tests: `OutboxFlowTests` (real PostgreSQL and RabbitMQ via Testcontainers). The consumer side lives
in `apps/notification-service` (`messaging/MessagingConfig` declares its queues,
`TodoCompletedListener`, `UserStatusListener`, `NotificationFlowTests`, `UserStatusTests`).

## Why asynchronous

- The request does not wait for side effects (notifications, e-mails, statistics, audit).
- A failing consumer or broker does not fail the user's action; the work waits and is retried.
- The producer does not know its consumers: a new one binds its own queue to `todo.events`, and
  `TodoService` does not change (loose coupling). java-api declares only the exchanges; each
  consumer declares its own queues and dead-letter queues.
- Services stay independent: notification-service works while java-api is down or asleep, because
  everything it needs arrived as events earlier.

The price: eventual consistency (the notification appears a moment later), more moving parts, and
the delivery problems below.

## RabbitMQ in five terms

| Term              | Here                                                    | Analogy                 |
| ----------------- | ------------------------------------------------------- | ----------------------- |
| Exchange          | `todo.events` (topic): receives messages, routes them   | sorting office          |
| Routing key       | `todo.completed`: the event type                        | address on the envelope |
| Queue             | `notification.todo-completed`: one per consumer purpose | mailbox                 |
| Binding           | "queue X wants routing keys matching Y from exchange Z" | forwarding order        |
| Dead-letter queue | `...dlq`: messages the consumer gave up on              | "undeliverable" shelf   |

A message is removed from the queue only when the consumer acknowledges it (after the listener
method returned, i.e. after the commit). If the app dies mid-processing, RabbitMQ delivers it again.

**RabbitMQ vs Kafka** (a common interview question): RabbitMQ is a message broker. Queues deliver
each message to one consumer, and it is deleted after the ack. Routing is flexible (exchanges).
Kafka is a distributed log. Messages stay for a retention period, each consumer group keeps its
own offset and can re-read history (replay). Ordering is per partition, and throughput is very
high. Use RabbitMQ for task/work queues and integration events. Use Kafka for event streaming,
event sourcing, analytics pipelines and many independent readers of the same history.

## The dual-write problem and the transactional outbox

Saving the todo and sending the event are writes to two systems without a shared transaction:

- send, then commit: the commit fails → an event about something that never happened;
- commit, then send: the app crashes or the broker is down → the event is lost.

The outbox turns them into one write: the event is a row in the same database, in the same
transaction (`Outbox.record`, `Propagation.MANDATORY` so it cannot run without one). A separate
process (`OutboxRelay`) moves rows to the broker afterwards and marks them as published.

Alternatives worth knowing: change data capture (Debezium reads the database's write-ahead log and
publishes the outbox rows, no polling), or `@TransactionalEventListener(AFTER_COMMIT)` +
direct send (simple, but loses the event on a crash between commit and send).

## Delivery guarantees

- **At least once.** The relay marks rows only after RabbitMQ confirmed it stored them
  (publisher confirms, `spring.rabbitmq.publisher-confirm-type=simple`). If the app dies between
  the confirm and the commit, the rows are sent again. Exactly-once delivery across systems does
  not exist in practice; "effectively once" is at-least-once + an idempotent consumer.
- **Idempotent consumer.** The outbox row ID travels as the AMQP `message_id`; the listener inserts
  with `ON CONFLICT (event_id) DO NOTHING` (unique constraint), so a duplicate is a no-op even when
  two copies are processed at the same moment.
- **Retry and dead letters.** A failing listener is retried 3 times with backoff (1, 2, 4 s), then
  rejected without requeue, and the queue's dead-letter exchange moves it to the DLQ. A message
  that cannot be parsed (invalid JSON) is rejected right away, because retrying cannot fix it.
  Without this, one "poison message" would be redelivered forever and block the queue.
- **Ordering** is not guaranteed across relay instances or retries. Consumers must not depend on
  it. `TodoCompleted` events are independent; for `user.blocked` / `user.unblocked` the order
  matters, so each carries `occurredAt` and notification-service keeps the newest change (an
  older event arriving late is ignored, see `UserStatusRepository.save`).
- **Several app instances.** `FOR UPDATE SKIP LOCKED` makes each relay lock and send different
  rows, so two instances never send the same row at the same time.

## Operations

- RabbitMQ management UI (local): http://localhost:15672, user/password `java_api`. See queues,
  message rates, the DLQ; a dead letter can be inspected and moved back ("Move messages", shovel
  plugin) after the bug is fixed.
- Published outbox rows are deleted after 7 days (`app.outbox.retention`, nightly cron).
- Broker down: requests still work, events pile up in `outbox_event` (`published_at IS NULL`) and
  go out when it is back. That count is the metric to alert on in production.
- `/actuator/health` includes RabbitMQ; readiness (Render's health check) does not, so a broker
  outage does not take the API offline.
- Production broker: CloudAMQP free plan, `SPRING_RABBITMQ_ADDRESSES=amqps://user:pass@host/vhost`
  in the Render dashboard.

## Changing an event

`TodoCompletedEvent` is a contract like the REST API, just not in `openapi.yaml` (AsyncAPI is the
equivalent spec for messages). Producer and consumer share no code: each service has its own record
for the same JSON (java-api `messaging/TodoCompletedEvent`, notification-service
`messaging/TodoCompletedEvent`), so they can be built and deployed independently. Change it additively: new optional fields are fine; renaming or
removing fields breaks consumers still running the old code, and messages already in the queue or
in the outbox keep the old shape. For an incompatible change publish a new event type
(`todo.completed.v2`) next to the old one.
