package com.example.notificationservice.messaging;

import java.time.Instant;

/**
 * A todo was marked as completed in java-api. This service's own copy of the message contract:
 * java-api publishes {@code com.example.javaapi.messaging.TodoCompletedEvent}, which is serialized
 * to the same JSON. Services share no code, only the message shape, so both records must be changed
 * additively and together (a consumer ignores fields it does not know).
 * <p>
 * The event ID is not part of the body: it travels as the AMQP {@code message_id} property.
 *
 * @param todoId the completed todo
 * @param ownerId Auth0 user ID of the todo's owner
 * @param title the title at the time of completion
 * @param completedAt when it was completed
 */
public record TodoCompletedEvent(long todoId, String ownerId, String title, Instant completedAt) {

	/** Event type, used as the routing key. */
	public static final String TYPE = "todo.completed";

}
