package com.example.javaapi.messaging;

import java.time.Instant;

/**
 * An admin unblocked a user; the counterpart of {@link UserBlockedEvent}, with the same fields.
 *
 * @param userId Auth0 user ID
 * @param occurredAt when it happened
 */
public record UserUnblockedEvent(String userId, Instant occurredAt) {

	/** Event type, stored in the outbox and used as the routing key. */
	public static final String TYPE = "user.unblocked";

}
