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
 * V2 adds a NOT NULL column to a table that already has rows (as on Neon), V6 deletes the rows V2
 * gave to the {@code legacy} owner. The tests replay that: migrate a separate schema to an older
 * version, insert rows, then run the next migrations.
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

		flyway("2").migrate();

		assertThat(this.jdbc.queryForObject("SELECT owner_id FROM " + SCHEMA + ".todo", String.class))
			.isEqualTo("legacy");
		assertThatThrownBy(() -> this.jdbc.update("INSERT INTO " + SCHEMA + ".todo (title) VALUES ('No owner')"))
			.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void deletesLegacyTodosWithTheirSubtasks() {
		flyway("5").migrate();
		long legacyId = insertTodo("Created before login", "legacy");
		long ownedId = insertTodo("Mine", "auth0|alice");
		this.jdbc.update("INSERT INTO " + SCHEMA + ".subtask (todo_id, title) VALUES (?, 'Old step')", legacyId);

		flyway("latest").migrate();

		assertThat(this.jdbc.queryForList("SELECT id FROM " + SCHEMA + ".todo", Long.class)).containsExactly(ownedId);
		assertThat(this.jdbc.queryForObject("SELECT count(*) FROM " + SCHEMA + ".subtask", Long.class)).isZero();
	}

	private long insertTodo(String title, String ownerId) {
		return this.jdbc.queryForObject(
				"INSERT INTO " + SCHEMA + ".todo (title, owner_id) VALUES (?, ?) RETURNING id", Long.class, title,
				ownerId);
	}

}
