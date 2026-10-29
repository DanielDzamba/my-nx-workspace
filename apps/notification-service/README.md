# notification-service

In-app notifications of the signed-in user (the bell in `angular-demo`), as a separate Spring Boot 4
service (Java 21, Maven). It was extracted from `java-api` and shares no code and no database with
it: everything it knows comes from java-api's events over RabbitMQ.

```
java-api ──todo.completed──────────────► RabbitMQ ──► TodoCompletedListener ──► notification
         ──user.blocked / user.unblocked──►         ──► UserStatusListener    ──► user_status
                                                                                  │
angular-demo ── GET /api/notifications (same Auth0 token as java-api) ──► BlockedUserFilter ──► REST
```

## Why a separate service

- Notifications will grow channels with their own load and failure modes (WebSockets, e-mail and
  SMS through external providers with retries and rate limits). None of that may slow down or break
  saving a todo.
- The seam was already there: the `notification` package used nothing of `todo` or `user`, its
  table had no foreign key, and it was fed only by events.
- `todo` and `user` stay together in java-api: they share a foreign key and are queried together,
  so splitting them would turn joins into network calls.

## How it stays independent

- **Authentication:** validates the Auth0 JWT itself (Auth0's public keys, issuer, audience
  `https://todo-api`); it never asks java-api who the user is.
- **Blocked users:** java-api owns `users.blocked`. Every change arrives as an event, and this
  service keeps its own copy (`user_status`), so the check works while java-api is down or asleep.
  It answers 403 with the same problem type as java-api. The copy is eventually consistent (about
  a second behind), and events carry `occurredAt`, so an older one arriving late is ignored.
- **Database per service:** its own PostgreSQL database (Flyway `V1`). java-api cannot read it.
- **Own contract:** [`api-contract/notification-service/openapi.yaml`](../../api-contract/notification-service/openapi.yaml);
  `NotificationsApi` and its DTOs are generated from it on every build.
- **Own queues:** it declares and binds its queues and dead-letter queues
  (`messaging/MessagingConfig`); java-api only knows its exchanges.

## Commands

```sh
npx nx serve notification-service   # starts notification-postgres + rabbitmq (apps/java-api/compose.yaml), then the app on http://localhost:8081
npx nx test notification-service    # Testcontainers (PostgreSQL, RabbitMQ); skipped without Docker
npx nx build notification-service   # jar -> apps/notification-service/target/
```

`serve` runs with the profile `local` (`application-local.properties`): database on port 5433,
broker shared with java-api. `npx nx serve angular-demo` proxies `/api/notifications` here and the
rest of `/api` to java-api (`proxy.conf.json`). Concepts (outbox, at-least-once, idempotency,
dead-letter queue): [docs/java-api/messaging.md](../../docs/java-api/messaging.md).

## Endpoints

- `GET /api/notifications` — the signed-in user's newest 20 notifications and `unreadCount`
- `POST /api/notifications/read-all` — marks all as read
- `GET /actuator/health`, `/actuator/health/liveness`, `/actuator/health/readiness` (public)

## Configuration (deployed)

| Variable                                            | Value                                                     |
| --------------------------------------------------- | --------------------------------------------------------- |
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | its own database (Neon: `notifications`, same project)    |
| `SPRING_RABBITMQ_ADDRESSES`                         | the same CloudAMQP broker as java-api (`amqps://...`)     |
| `APP_CORS_ALLOWED_ORIGINS`                          | frontend origin(s), e.g. `https://danieldzamba.github.io` |
| `PORT`                                              | HTTP port if the host injects one (default 8081)          |

Render: service `danieldzamba-notification-service` in [`render.yaml`](../../render.yaml).
