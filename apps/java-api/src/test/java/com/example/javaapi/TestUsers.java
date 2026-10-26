package com.example.javaapi;

import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Rows in {@code users} for tests that save todos straight to the database: {@code todo.owner_id}
 * is a foreign key to {@code users} (V7). In the app, a user's first request creates the row.
 */
public final class TestUsers {

	private TestUsers() {
	}

	/** Creates the users that do not exist yet. */
	public static void create(JdbcTemplate jdbc, String... ids) {
		for (String id : ids) {
			jdbc.update("INSERT INTO users (id) VALUES (?) ON CONFLICT (id) DO NOTHING", id);
		}
	}

}
