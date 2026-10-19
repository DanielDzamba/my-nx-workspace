# syntax=docker/dockerfile:1

# Build context is the repository root (render.yaml, compose.yaml), because the build also needs
# the API contract in api-contract/ next to apps/: pom.xml generates the API interfaces from it.
# Root .dockerignore keeps the context to these files.

# --- Build stage: JDK + Maven wrapper ---
FROM eclipse-temurin:21-jdk AS build
# Same layout as the repository, so pom.xml finds ../../api-contract
WORKDIR /workspace/apps/java-api

# Dependencies first, so they stay cached until pom.xml changes
COPY apps/java-api/.mvn .mvn
COPY apps/java-api/mvnw apps/java-api/pom.xml ./
RUN ./mvnw -B dependency:go-offline

COPY api-contract/openapi.yaml /workspace/api-contract/
COPY apps/java-api/src src
RUN ./mvnw -B package -DskipTests \
 && cp target/*.jar app.jar \
 && java -Djarmode=tools -jar app.jar extract --layers --destination extracted

# --- Runtime stage: JRE only, non-root ---
FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 spring
WORKDIR /app

# Least frequently changing layers first
COPY --from=build /workspace/apps/java-api/extracted/dependencies/ ./
COPY --from=build /workspace/apps/java-api/extracted/spring-boot-loader/ ./
COPY --from=build /workspace/apps/java-api/extracted/snapshot-dependencies/ ./
COPY --from=build /workspace/apps/java-api/extracted/application/ ./

USER spring
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "app.jar"]
