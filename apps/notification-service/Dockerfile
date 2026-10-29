# syntax=docker/dockerfile:1

# Same structure as apps/java-api/Dockerfile. Build context is the repository root (render.yaml),
# because the build also needs this service's API contract: pom.xml generates the API interface
# from api-contract/notification-service/openapi.yaml. Root .dockerignore keeps the context small.

# --- Build stage: JDK + Maven wrapper ---
FROM eclipse-temurin:21-jdk AS build
# Same layout as the repository, so pom.xml finds ../../api-contract
WORKDIR /workspace/apps/notification-service

# Dependencies first, so they stay cached until pom.xml changes
COPY apps/notification-service/.mvn .mvn
COPY apps/notification-service/mvnw apps/notification-service/pom.xml ./
RUN ./mvnw -B dependency:go-offline

COPY api-contract/notification-service/openapi.yaml /workspace/api-contract/notification-service/
COPY apps/notification-service/src src
RUN ./mvnw -B package -DskipTests \
 && cp target/*.jar app.jar \
 && java -Djarmode=tools -jar app.jar extract --layers --destination extracted

# --- Runtime stage: JRE only, non-root ---
FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 spring
WORKDIR /app

# Least frequently changing layers first
COPY --from=build /workspace/apps/notification-service/extracted/dependencies/ ./
COPY --from=build /workspace/apps/notification-service/extracted/spring-boot-loader/ ./
COPY --from=build /workspace/apps/notification-service/extracted/snapshot-dependencies/ ./
COPY --from=build /workspace/apps/notification-service/extracted/application/ ./

USER spring
EXPOSE 8081
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "app.jar"]
