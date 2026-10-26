# java-api

Spring Boot 4 (Java 21, Maven) API with PostgreSQL, RabbitMQ and Redis, wired into Nx via `project.json`.

## Prerequisites

- JDK 21 on `PATH` (or `JAVA_HOME` set). Maven is not required; the Maven wrapper (`mvnw`) downloads it.
- Docker (Docker Desktop on Windows/macOS) for the local PostgreSQL, RabbitMQ and Redis and for the integration tests.

## Commands

```sh
npx nx serve java-api   # starts PostgreSQL + RabbitMQ + Redis (compose.yaml) + the app on http://localhost:8080
npx nx test java-api    # tests; the Testcontainers test is skipped without Docker
npx nx build java-api   # jar -> apps/java-api/target/
npx nx clean java-api
```

## API contract (design-first)

The API is defined in [`api-contract/openapi.yaml`](../../api-contract/openapi.yaml), not in the
controllers. Every `mvn compile` generates the interfaces (`TodosApi`, `AdminApi`, `UsersApi`, `NotificationsApi`, `HelloApi`) and
the request/response DTOs into `target/generated-sources/openapi`; the controllers implement them,
so paths, parameters, defaults and validation come from the contract. Workflow:
[`api-contract/README.md`](../../api-contract/README.md).

- Swagger UI: http://localhost:8080/swagger-ui.html shows the contract (served as `/openapi.yaml`);
  nothing is generated from the code (`springdoc.api-docs.enabled=false`).
- IDE errors like "cannot resolve `com.example.javaapi.api`": reload the Maven project after a
  build, so the IDE picks up the generated sources.

## Database

| Environment | Where PostgreSQL comes from                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| Local run   | `compose.yaml`, started automatically by `spring-boot-docker-compose` and left running (`docker compose down` stops it) |
| Tests       | Testcontainers (`TestcontainersConfiguration`, `@ServiceConnection`)                                                    |
| Deployed    | `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` env vars                            |

- Schema changes are Flyway migrations in `src/main/resources/db/migration` (`V1__create_todo.sql`, `V2__...`). Hibernate only validates the schema (`ddl-auto=validate`).
- Never edit a migration that has already run; add a new one.
- `V4` enables the `pg_trgm` extension (title search index). PostgreSQL images and Neon ship it; the migration user needs the right to `CREATE EXTENSION` (Neon's owner role has it).
- Query performance (paging, N+1, EXPLAIN, open-in-view): [docs/java-api/data-access.md](../../docs/java-api/data-access.md).
- Local credentials (`java_api` / `java_api`) are for development only.

## Messaging (RabbitMQ)

Completing a todo records a `TodoCompleted` event in the outbox table (same transaction); a
scheduled relay publishes it to RabbitMQ and a listener stores a notification for the owner.
Concepts (outbox, at-least-once, idempotency, dead-letter queue): [docs/java-api/messaging.md](../../docs/java-api/messaging.md).

| Environment | Where RabbitMQ comes from                                                                   |
| ----------- | ------------------------------------------------------------------------------------------- |
| Local run   | `compose.yaml`; management UI http://localhost:15672 (`java_api` / `java_api`)              |
| Tests       | Testcontainers (`TestcontainersConfiguration`)                                              |
| Deployed    | CloudAMQP (free plan), `SPRING_RABBITMQ_ADDRESSES=amqps://<user>:<password>@<host>/<vhost>` |

`spring-boot-docker-compose` skips `compose.yaml` when any of its services already runs, so a
PostgreSQL container started before RabbitMQ was added keeps RabbitMQ down (connection refused,
then `guest` login failures). Run `docker compose up -d` in `apps/java-api` once and restart the app.
The same applies to Redis (warnings `Cache users: get ... failed`).

## Users and cache (Redis)

The first request of a user creates them in the `users` table (`UserProvisioningFilter`), with name
and email from the access token. Admins list users and block them; a blocked user gets 403 on every
request. The user lookup on every request is cached in Redis (`@Cacheable`, evicted on every change,
TTL 5 min). Concepts (cache-aside, eviction vs TTL, the proxy trap, why Redis, when not to cache):
[docs/java-api/caching.md](../../docs/java-api/caching.md).

| Environment | Where Redis comes from                                                                   |
| ----------- | ---------------------------------------------------------------------------------------- |
| Local run   | `compose.yaml`; look inside with `docker compose exec redis redis-cli KEYS 'java-api:*'` |
| Tests       | Testcontainers (`TestcontainersConfiguration`)                                           |
| Deployed    | Render Key Value (free), `SPRING_DATA_REDIS_URL` wired by `render.yaml`                  |

Without Redis the app keeps working, every request then reads the database.

## Docker image

```sh
docker compose --profile full up --build   # PostgreSQL + RabbitMQ + API container on :8080
docker build -t java-api -f Dockerfile ../..  # image only; context is the repo root (needs api-contract/)
```

## Deployment

| Part       | Host                                                                          | Config                               |
| ---------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| Frontend   | GitHub Pages: https://danieldzamba.github.io/my-nx-workspace/                 | `.github/workflows/deploy-pages.yml` |
| java-api   | Render (free web service, Docker): https://danieldzamba-java-api.onrender.com | `render.yaml` (Blueprint)            |
| PostgreSQL | Neon (free, AWS eu-central-1)                                                 | env vars in the Render dashboard     |
| RabbitMQ   | CloudAMQP (free plan "Little Lemur", EU region)                               | env var in the Render dashboard      |
| Redis      | Render Key Value (free, Frankfurt, internal only, no persistence)             | `render.yaml` (Blueprint)            |

- Render deploys a commit on `main` once CI has passed on it (`autoDeployTrigger: checksPass`).
- The free service sleeps after 15 minutes without traffic; the first request then waits for the app to start (up to about a minute). Neon suspends the database after 5 idle minutes and resumes it on the next connection.
- Neon shows a connection string like `postgresql://<user>:<password>@<host>/<db>?sslmode=require`. Split it for Spring: `SPRING_DATASOURCE_URL=jdbc:postgresql://<host>/<db>?sslmode=require` plus `_USERNAME` and `_PASSWORD`. Use the direct host (without `-pooler`), because Flyway needs a session-level connection.

### Settings

| Env var                                             | Purpose                                                   |
| --------------------------------------------------- | --------------------------------------------------------- |
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | database connection                                       |
| `SPRING_RABBITMQ_ADDRESSES`                         | broker URL from CloudAMQP (`amqps://...`)                 |
| `SPRING_DATA_REDIS_URL`                             | Redis URL (`redis://host:port`), set by the Blueprint     |
| `APP_CORS_ALLOWED_ORIGINS`                          | frontend origin(s), e.g. `https://danieldzamba.github.io` |
| `PORT`                                              | HTTP port if the host injects one (default 8080)          |

## Endpoints

- `GET /api/hello?name=Nx` → `{"message":"Hello, Nx!"}`
- `GET /api/todos?status=all|active|completed&q=milk&page=0&size=10&sort=createdAt,desc` — one page of the signed-in user's todos (owner = `sub` of the access token), each with `subtaskCount` / `completedSubtaskCount`. Sortable by `createdAt` or `title`; `size` is capped at 100. Response: `{"content": [...], "page": {"size", "number", "totalElements", "totalPages"}}` (Spring Data `PagedModel`)
- `POST /api/todos`, `PUT|DELETE /api/todos/{id}`; `GET /api/todos/{id}` returns the todo with its `subtasks`. Another user's todo answers 404
- `POST /api/todos/{id}/subtasks`, `PUT|DELETE /api/todos/{id}/subtasks/{subtaskId}` — subtasks of an own todo
- `GET /api/admin/todos?page=&size=&sort=` — one page of all users' todos with `ownerId`, `ownerName`, `ownerEmail` (default 20, newest first); role `ADMIN` only (401 without a token, 403 without the role)
- `GET /api/admin/users?page=&size=` — all users, newest first; `PUT /api/admin/users/{id}/blocked` with `{"blocked": true|false}` (409 for the admin themselves). Role `ADMIN` only
- Every `/api` request of a blocked user answers 403 with `type: https://todo-api/problems/user-blocked`
- `GET /api/notifications` — the signed-in user's newest 20 notifications and `unreadCount`; `POST /api/notifications/read-all` marks all as read. Created asynchronously when a todo becomes completed
- `GET /actuator/health` (includes the database, RabbitMQ and Redis), `/actuator/health/liveness`, `/actuator/health/readiness`

## Roles, name and email (Auth0)

Every signed-in user is a regular user. `ADMIN` is an Auth0 role, delivered in the custom claim
`https://todo-api/roles` (`SecurityConfig.ROLES_CLAIM`) of the access token (backend) and the ID
token (frontend, to show the admin page). Name and email reach the backend in
`https://todo-api/name` and `https://todo-api/email` of the access token (`UserProvisioningFilter`),
which has no profile claims of its own. Setup in the Auth0 dashboard:

1. **User Management → Roles**: create role `ADMIN` and assign it to the admin users.
2. **Actions → Library → Create Action** (trigger _Login / Post Login_), deploy it:

   ```js
   exports.onExecutePostLogin = async (event, api) => {
     const roles = event.authorization?.roles ?? [];
     api.accessToken.setCustomClaim('https://todo-api/roles', roles);
     api.idToken.setCustomClaim('https://todo-api/roles', roles);
     api.accessToken.setCustomClaim('https://todo-api/name', event.user.name);
     api.accessToken.setCustomClaim('https://todo-api/email', event.user.email);
   };
   ```

3. **Actions → Triggers → post-login**: drag the Action into the flow and apply.

A role or profile change reaches the tokens at the next login or token refresh. Without the name and
email claims, users are still created, only without name and email.
