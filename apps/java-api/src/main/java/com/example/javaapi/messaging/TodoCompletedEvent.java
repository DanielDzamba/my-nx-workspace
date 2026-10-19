package com.example.javaapi.messaging;

import java.time.Instant;

/**
 * A todo was marked as completed. This record is the message contract between the producer
 * ({@code TodoService}, through the outbox) and the consumers: it is serialized to JSON, so renaming
 * or removing a field breaks consumers that still read the old shape. Change it additively, like
 * the REST contract.
 * <p>
 * The event ID is not part of the body: it travels as the AMQP {@code message_id} property.
 *
 * @param todoId the completed todo
 * @param ownerId Auth0 user ID of the todo's owner
 * @param title the title at the time of completion
 * @param completedAt when it was completed
 */
public record TodoCompletedEvent(long todoId, String ownerId, String title, Instant completedAt) {

	/** Event type, stored in the outbox and used as the routing key. */
	public static final String TYPE = "todo.completed";

}
