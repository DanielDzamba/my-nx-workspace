---
name: run-java-api
description: Launch and smoke-test the java-api Spring Boot app (apps/java-api) in this Nx workspace. Use when asked to run, start, serve, restart or stop the Java app/API, or to verify a change in it against the live server.
---

# Run java-api (Spring Boot)

The app lives in `apps/java-api`: Spring Boot, Java 21, Maven wrapper, served on **port 8080**.
Nx targets call `tools/scripts/mvnw.mjs`, which picks `mvnw.cmd` on Windows and `mvnw` elsewhere.

## Prerequisites

- JDK 21 on `PATH` (`java -version` should print 21.x). Maven itself is not needed; the wrapper downloads it.
- `node_modules` installed at the repo root (`npm install`) so `npx nx` works.
- Port 8080 free. If it is taken, find the owner first (Windows: `netstat -ano | findstr :8080`).

## 1. Start the server (background)

Run from the repo root, redirect output to a log file, and run it as a background task:

```bash
npx nx serve java-api > "$LOG" 2>&1
```

Use a log path in the session scratchpad directory for `$LOG`.
`serve` runs `mvnw spring-boot:run` and does not exit while the app is up.

## 2. Wait for startup

The first run downloads dependencies and can take a few minutes. Later starts take about 5 seconds.
Wait until the log shows success or a failure, then print the key lines:

```bash
for i in $(seq 1 240); do
  grep -qE "Started .* in|APPLICATION FAILED|BUILD FAILURE|ERROR" "$LOG" 2>/dev/null && break
  sleep 1
done
grep -E "Started|Tomcat started|FAILED|FAILURE|ERROR" "$LOG" | tail -20
```

On success the log contains `Tomcat started on port 8080` and `Started JavaApiApplication in X seconds`.

## 3. Drive it

```bash
curl -s -w "\nHTTP %{http_code}\n" http://localhost:8080/api/hello
curl -s -w "\nHTTP %{http_code}\n" "http://localhost:8080/api/hello?name=Daniel"
curl -s -w "\nHTTP %{http_code}\n" http://localhost:8080/actuator/health
```

Expected results:
- `/api/hello` returns `{"message":"Hello, world..."}` with HTTP 200.
- `/actuator/health` returns JSON containing `"status":"UP"` with HTTP 200.

Only the `health` and `info` actuator endpoints are exposed.
If the diff adds or changes a controller, call that route too and read the response body.

## 4. Code changes while it runs

`spring-boot-devtools` is on the classpath, so the app restarts itself when compiled classes change.
Editing a `.java` file does not trigger a restart until the class is recompiled, either by the IDE or by `npx nx build java-api`.
If a change doesn't show up, stop the server and start it again.

## 5. Stop the server

Stop the background task that runs `nx serve`.
If the Java process outlives it and port 8080 stays taken, kill it:

- Windows (PowerShell): `Get-NetTCPConnection -LocalPort 8080 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`
- Unix: `kill $(lsof -t -i:8080)`

## Other targets

| Command | What it does |
|---|---|
| `npx nx build java-api` | `mvnw -B package -DskipTests` produces `apps/java-api/target/*.jar` |
| `npx nx test java-api` | `mvnw -B test` |
| `npx nx clean java-api` | `mvnw -B clean` |

To run the packaged jar directly: `java -jar apps/java-api/target/java-api-*.jar`.

## Troubleshooting

- **`UnsupportedClassVersionError` or `release version 21 not supported`**: the wrong JDK is on `PATH` or `JAVA_HOME`. Point both at JDK 21.
- **`Port 8080 was already in use`**: another instance is still running. Stop it (see step 5) or start with `-Dspring-boot.run.arguments=--server.port=8081`.
- **PostgreSQL**: it is not wired up yet. The datasource settings in `application.properties` are commented out, so the app needs no database.
