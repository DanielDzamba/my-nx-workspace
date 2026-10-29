package com.example.javaapi.outbox;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestcontainersConfiguration;
import com.example.javaapi.messaging.UserBlockedEvent;

import tools.jackson.databind.json.JsonMapper;

/**
 * V9 sends a {@code user.blocked} for every user blocked before notification-service existed. Like
 * TodoOwnerMigrationTests: migrate a separate schema to V8, insert rows, then run V9.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class BlockedUsersBackfillMigrationTests {

	private static final String SCHEMA = "backfill_test";

	@Autowired
	private DataSource dataSource;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private JsonMapper jsonMapper;

	@AfterEach
	void dropSchema() {
		this.jdbc.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
	}

	private Flyway flyway(String target) {
		return Flyway.configure().dataSource(this.dataSource).schemas(SCHEMA).target(target).load();
	}

	@Test
	void recordsUserBlockedForEveryBlockedUser() {
		flyway("8").migrate();
		this.jdbc.update("INSERT INTO " + SCHEMA + ".users (id, blocked) VALUES ('auth0|blocked', true)");
		this.jdbc.update("INSERT INTO " + SCHEMA + ".users (id, blocked) VALUES ('auth0|active', false)");

		flyway("9").migrate();

		List<String> payloads = this.jdbc.queryForList("SELECT payload::text FROM " + SCHEMA
				+ ".outbox_event WHERE aggregate_type = 'User' AND event_type = 'user.blocked'", String.class);
		assertThat(payloads).hasSize(1);
		// The JSON built in SQL must read like the one Jackson writes for the record
		UserBlockedEvent event = this.jsonMapper.readValue(payloads.get(0), UserBlockedEvent.class);
		assertThat(event.userId()).isEqualTo("auth0|blocked");
		assertThat(event.occurredAt()).isBefore(Instant.now());
	}

}
