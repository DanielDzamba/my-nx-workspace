# syntax=docker/dockerfile:1

# --- Build stage: JDK + Maven wrapper ---
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

# Dependencies first, so they stay cached until pom.xml changes
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN ./mvnw -B dependency:go-offline

COPY src src
RUN ./mvnw -B package -DskipTests \
 && cp target/*.jar app.jar \
 && java -Djarmode=tools -jar app.jar extract --layers --destination extracted

# --- Runtime stage: JRE only, non-root ---
FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 spring
WORKDIR /app

# Least frequently changing layers first
COPY --from=build /workspace/extracted/dependencies/ ./
COPY --from=build /workspace/extracted/spring-boot-loader/ ./
COPY --from=build /workspace/extracted/snapshot-dependencies/ ./
COPY --from=build /workspace/extracted/application/ ./

USER spring
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75"
ENTRYPOINT ["java", "-jar", "app.jar"]
