package com.example.notificationservice.user;

import java.sql.Timestamp;
import java.time.Instant;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * This service's copy of whether a user is blocked (table {@code user_status}). java-api owns the
 * users; it sends every change as an event ({@link UserStatusListener}), so a request here never
 * has to call java-api: the check works even while java-api is down or asleep. The price is
 * eventual consistency: a block takes effect here about a second later.
 */
@Repository
public class UserStatusRepository {

	private final JdbcClient jdbc;

	UserStatusRepository(JdbcClient jdbc) {
		this.jdbc = jdbc;
	}

	/** Users never blocked have no row and are not blocked. */
	public boolean isBlocked(String userId) {
		return this.jdbc.sql("SELECT blocked FROM user_status WHERE user_id = :userId")
			.param("userId", userId)
			.query(Boolean.class)
			.optional()
			.orElse(false);
	}

	/**
	 * Stores the status unless a newer change is stored already. Last write wins by
	 * {@code occurredAt}, not by arrival: an old {@code user.unblocked} that is redelivered after a
	 * newer {@code user.blocked} must not unblock the user again. The same event twice changes
	 * nothing, so this is idempotent without remembering event IDs.
	 *
	 * @return 1 if stored, 0 if a newer (or the same) change was there
	 */
	int save(String userId, boolean blocked, Instant occurredAt) {
		return this.jdbc.sql("""
				INSERT INTO user_status (user_id, blocked, changed_at)
				VALUES (:userId, :blocked, :occurredAt)
				ON CONFLICT (user_id) DO UPDATE
				SET blocked = EXCLUDED.blocked, changed_at = EXCLUDED.changed_at
				WHERE user_status.changed_at < EXCLUDED.changed_at
				""")
			.param("userId", userId)
			.param("blocked", blocked)
			.param("occurredAt", Timestamp.from(occurredAt))
			.update();
	}

}
