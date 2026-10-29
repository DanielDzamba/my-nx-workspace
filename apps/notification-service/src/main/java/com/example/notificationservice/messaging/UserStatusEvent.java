package com.example.notificationservice.messaging;

import java.time.Instant;

/**
 * An admin blocked or unblocked a user in java-api (which owns the users). Body of both
 * {@code user.blocked} and {@code user.unblocked}; the routing key says which one it is. This
 * service's copy of java-api's {@code UserBlockedEvent} / {@code UserUnblockedEvent}.
 *
 * @param userId Auth0 user ID
 * @param occurredAt when it happened; orders the events, because RabbitMQ may deliver them out of
 * order (e.g. a retried older one after a newer one)
 */
public record UserStatusEvent(String userId, Instant occurredAt) {

	public static final String BLOCKED = "user.blocked";

	public static final String UNBLOCKED = "user.unblocked";

}
