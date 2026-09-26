# java-api

Spring Boot 4 (Java 21, Maven) API with PostgreSQL, wired into Nx via `project.json`.

## Prerequisites

- JDK 21 on `PATH` (or `JAVA_HOME` set). Maven is not required; the Maven wrapper (`mvnw`) downloads it.
- Docker (Docker Desktop on Windows/macOS) for the local PostgreSQL and for the integration test.

## Commands

```sh
npx nx serve java-api   # starts PostgreSQL (compose.yaml) + the app on http://localhost:8080
npx nx test java-api    # tests; the Testcontainers test is skipped without Docker
npx nx build java-api   # jar -> apps/java-api/target/
npx nx clean java-api
```

## Database

| Environment | Where PostgreSQL comes from                                                                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| Local run   | `compose.yaml`, started automatically by `spring-boot-docker-compose` and left running (`docker compose down` stops it) |
| Tests       | Testcontainers (`TestcontainersConfiguration`, `@ServiceConnection`)                                                    |
| Deployed    | `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` env vars                            |

- Schema changes are Flyway migrations in `src/main/resources/db/migration` (`V1__create_todo.sql`, `V2__...`). Hibernate only validates the schema (`ddl-auto=validate`).
- Never edit a migration that has already run; add a new one.
- Local credentials (`java_api` / `java_api`) are for development only.

## Docker image

```sh
docker compose --profile full up --build   # PostgreSQL + API container on :8080
docker build -t java-api .                 # image only
```

## Deployment

| Part       | Host                                                                          | Config                               |
| ---------- | ----------------------------------------------------------------------------- | ------------------------------------ |
| Frontend   | GitHub Pages: https://danieldzamba.github.io/my-nx-workspace/                 | `.github/workflows/deploy-pages.yml` |
| java-api   | Render (free web service, Docker): https://danieldzamba-java-api.onrender.com | `render.yaml` (Blueprint)            |
| PostgreSQL | Neon (free, AWS eu-central-1)                                                 | env vars in the Render dashboard     |

- Render deploys a commit on `main` once CI has passed on it (`autoDeployTrigger: checksPass`).
- The free service sleeps after 15 minutes without traffic; the first request then waits for the app to start (up to about a minute). Neon suspends the database after 5 idle minutes and resumes it on the next connection.
- Neon shows a connection string like `postgresql://<user>:<password>@<host>/<db>?sslmode=require`. Split it for Spring: `SPRING_DATASOURCE_URL=jdbc:postgresql://<host>/<db>?sslmode=require` plus `_USERNAME` and `_PASSWORD`. Use the direct host (without `-pooler`), because Flyway needs a session-level connection.

### Settings

| Env var                                             | Purpose                                                   |
| --------------------------------------------------- | --------------------------------------------------------- |
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | database connection                                       |
| `APP_CORS_ALLOWED_ORIGINS`                          | frontend origin(s), e.g. `https://danieldzamba.github.io` |
| `PORT`                                              | HTTP port if the host injects one (default 8080)          |

## Endpoints

- `GET /api/hello?name=Nx` → `{"message":"Hello, Nx!"}`
- `GET /actuator/health` (includes the database), `/actuator/health/liveness`, `/actuator/health/readiness`
