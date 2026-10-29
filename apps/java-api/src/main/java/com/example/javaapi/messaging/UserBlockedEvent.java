package com.example.javaapi.messaging;

import java.time.Instant;

/**
 * An admin blocked a user. Message contract like {@link TodoCompletedEvent}: change it additively.
 * Consumers keep their own copy of the blocked status (notification-service checks it on every
 * request), so they never have to ask this app.
 *
 * @param userId Auth0 user ID
 * @param occurredAt when it happened; consumers keep the newest change, as RabbitMQ may deliver
 * {@code user.blocked} and {@code user.unblocked} out of order
 */
public record UserBlockedEvent(String userId, Instant occurredAt) {

	/** Event type, stored in the outbox and used as the routing key. */
	public static final String TYPE = "user.blocked";

}
