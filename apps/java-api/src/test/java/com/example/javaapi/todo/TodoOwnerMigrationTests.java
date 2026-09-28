package com.example.javaapi.todo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestcontainersConfiguration;

/**
 * V2 adds a NOT NULL column to a table that already has rows (as on Neon). The test replays that:
 * migrate a separate schema to V1, insert a todo, then run the remaining migrations.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class TodoOwnerMigrationTests {

	private static final String SCHEMA = "migration_test";

	@Autowired
	private DataSource dataSource;

	@Autowired
	private JdbcTemplate jdbc;

	@AfterEach
	void dropSchema() {
		this.jdbc.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
	}

	private Flyway flyway(String target) {
		// Flyway creates the schema and runs the migrations with it as the default schema
		return Flyway.configure().dataSource(this.dataSource).schemas(SCHEMA).target(target).load();
	}

	@Test
	void assignsExistingTodosToLegacyOwner() {
		flyway("1").migrate();
		this.jdbc.update("INSERT INTO " + SCHEMA + ".todo (title) VALUES ('Created before login')");

		flyway("latest").migrate();

		assertThat(this.jdbc.queryForObject("SELECT owner_id FROM " + SCHEMA + ".todo", String.class))
			.isEqualTo("legacy");
		assertThatThrownBy(() -> this.jdbc.update("INSERT INTO " + SCHEMA + ".todo (title) VALUES ('No owner')"))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

}
