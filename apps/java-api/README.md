# java-api

Spring Boot 4 (Java 21, Maven) API, wired into Nx via `project.json`.

## Prerequisites

- JDK 21 on `PATH` (or `JAVA_HOME` set). Maven is not required; the Maven wrapper (`mvnw`) downloads it.

## Commands

```sh
npx nx serve java-api   # run on http://localhost:8080 (spring-boot:run)
npx nx test java-api    # unit tests
npx nx build java-api   # jar -> apps/java-api/target/
npx nx clean java-api
```

## Endpoints

- `GET /api/hello?name=Nx` → `{"message":"Hello, Nx!"}`
- `GET /actuator/health`

## TODO: PostgreSQL

1. Add `spring-boot-starter-data-jpa` and `org.postgresql:postgresql` (runtime) to `pom.xml`.
2. Uncomment the datasource properties in `src/main/resources/application.properties`.
3. Optionally add a `docker-compose.yml` with a `postgres:17` service for local development.
