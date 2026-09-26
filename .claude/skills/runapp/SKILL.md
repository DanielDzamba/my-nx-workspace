---
name: runapp
description: Launch the whole stack of this Nx workspace — PostgreSQL in Docker (port 5432), the java-api Spring Boot backend (port 8080) and the angular-demo Angular frontend (port 4200) — and smoke-test it. Use when asked to run, start or stop "the app(s)", both apps, the full stack, frontend and backend together, or on /runapp.
---

# Run PostgreSQL + java-api + angular-demo

Local development follows the "infrastructure in Docker, apps native" pattern:
only the database runs in a container, and both apps run natively for fast reloads and debugging.

| Part | Path | Command | URL |
|---|---|---|---|
| PostgreSQL 17 (Docker) | `apps/java-api/compose.yaml` | `docker compose up -d --wait` | `localhost:5432`, db/user/password `java_api` |
| java-api (Spring Boot, Java 21) | `apps/java-api` | `npx nx serve java-api` | http://localhost:8080 |
| angular-demo (Angular dev server) | `apps/angular-demo` | `npx nx serve angular-demo` | http://localhost:4200 |

The Angular dev server proxies `/api/**` to `http://localhost:8080` (`apps/angular-demo/proxy.conf.json`).
The frontend therefore calls relative `/api/...` URLs and needs no CORS locally.
Details for the backend alone (targets, devtools restarts, troubleshooting) are in the `run-java-api` skill.

## Prerequisites

- Docker running (`docker info` succeeds). On Windows that means Docker Desktop is started.
  Without Docker, java-api fails at startup because it has no database.
- JDK 21 on `PATH` (`java -version` prints 21.x).
- `node_modules` installed at the repo root (`npm install`).
- Ports 5432, 8080 and 4200 free. Check on Windows with `netstat -ano | findstr ":5432 :8080 :4200"`.
  A locally installed PostgreSQL service often holds 5432.
  If a port is taken, find out whether it is an earlier instance of this stack before killing anything.

## 1. Start the database

```bash
docker compose -f apps/java-api/compose.yaml up -d --wait
docker compose -f apps/java-api/compose.yaml ps
```

`--wait` returns once the `pg_isready` healthcheck passes; `ps` should show `postgres` as `healthy`.
java-api would also start this container by itself (`spring-boot-docker-compose`).
Starting it explicitly first keeps database errors out of the Java log.
Data persists in the `java-api_postgres-data` volume across restarts.

## 2. Start both servers (background)

Run from the repo root. Start each as its own background task, with output to a log file in the session scratchpad directory:

```bash
npx nx serve java-api > "$SCRATCH/java-api.log" 2>&1
```

```bash
npx nx serve angular-demo > "$SCRATCH/angular-demo.log" 2>&1
```

Neither command exits while its server is up. Do not combine them into one `nx run-many` call: separate logs make failures easy to attribute.

## 3. Wait for startup

The first java-api run downloads Maven dependencies and can take a few minutes; later starts take about 5–10 seconds.
The Angular dev server usually compiles in 5–20 seconds.

```bash
for i in $(seq 1 240); do
  grep -qE "Started .* in|APPLICATION FAILED|BUILD FAILURE" "$SCRATCH/java-api.log" 2>/dev/null && break
  sleep 1
done
grep -E "Started|Tomcat started|Flyway|Schema|FAILED|FAILURE|ERROR" "$SCRATCH/java-api.log" | tail -20

for i in $(seq 1 120); do
  grep -qE "Application bundle generation (complete|failed)|\[ERROR\]" "$SCRATCH/angular-demo.log" 2>/dev/null && break
  sleep 1
done
sed 's/\x1b\[[0-9;]*m//g' "$SCRATCH/angular-demo.log" | tail -20
```

The Angular log is full of ANSI color codes, so `Local:` / `localhost:4200` are split by escape sequences and cannot be grepped.
Match `Application bundle generation complete` instead, and strip the codes with `sed` before reading.

Success looks like:
- java-api: Flyway lines (`Successfully validated N migrations`, `Schema "public" is up to date` or `Successfully applied ...`), then `Tomcat started on port 8080` and `Started JavaApiApplication in X seconds`.
- angular-demo: `Application bundle generation complete`, then `Local: http://localhost:4200/`, with no `[ERROR]` / `✘` build errors.
- A `Browserslist: caniuse-lite is ... old` warning is harmless.

## 4. Smoke-test

```bash
curl -s -w "\nHTTP %{http_code}\n" http://localhost:8080/api/hello
curl -s -w "\nHTTP %{http_code}\n" http://localhost:8080/actuator/health
curl -s -o /dev/null -w "angular-demo HTTP %{http_code}\n" http://localhost:4200/
curl -s -w "\nHTTP %{http_code}\n" http://localhost:4200/api/hello
```

Expected:
- `/api/hello` → `{"message":"Hello, world!"}`, HTTP 200.
- `/actuator/health` → JSON with `"status":"UP"`, HTTP 200. The database is part of this check: if PostgreSQL is down, it reports `DOWN` / HTTP 503.
- `http://localhost:4200/` → HTTP 200 (the HTML shell containing `<app-root>`).
- `http://localhost:4200/api/hello` → the same JSON as on port 8080, which proves the dev-server proxy works.

If the change under test touches a controller or a component, hit that route too and read the response.
To look into the database: `docker compose -f apps/java-api/compose.yaml exec postgres psql -U java_api -d java_api -c '\dt'`.

## 5. Report

Tell the user the URLs and the smoke-test results. Leave the servers and the database running unless asked to stop them.

## 6. Stop

Stop both background tasks. If a process outlives its task and keeps a port:

- Windows (PowerShell):
  `Get-NetTCPConnection -LocalPort 8080,4200 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
- Unix: `kill $(lsof -t -i:8080 -i:4200)`

The database keeps running on purpose (`spring.docker.compose.lifecycle-management=start-only`). Stop it only when asked:

```bash
docker compose -f apps/java-api/compose.yaml down      # keeps the data
docker compose -f apps/java-api/compose.yaml down -v   # also wipes the database - confirm with the user first
```

## Troubleshooting

- **`docker: command not found` / `Cannot connect to the Docker daemon`**: Docker Desktop is not installed or not started. Tell the user rather than installing it yourself.
- **Port 5432 in use**: usually a native PostgreSQL service. Stop it, or change the host port in `compose.yaml` (e.g. `127.0.0.1:5433:5432`); spring-boot-docker-compose picks up the mapped port automatically.
- **Flyway validation error / `Schema-validation: missing table`**: a migration in `apps/java-api/src/main/resources/db/migration` is missing, or it was edited after it ran. Never edit applied migrations; add a new `V<n>__<description>.sql`. For a throwaway local DB, `down -v` resets it (ask first).
- **Port 4200 in use**: the Angular CLI may prompt to use another port, which hangs in a non-interactive shell. Free the port, or start with `npx nx serve angular-demo --port 4201`.
- **Port 8080 in use / wrong JDK**: see the `run-java-api` skill.
- **Stale Nx cache or daemon issues**: `npx nx reset`, then start again.
