package com.example.javaapi.notification;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.javaapi.api.model.NotificationResponse;
import com.example.javaapi.messaging.MessagingConfig;
import com.example.javaapi.messaging.TodoCompletedEvent;

/**
 * Turns {@code TodoCompleted} events into notifications for the todo's owner.
 * <p>
 * The message is acknowledged (removed from the queue) only after this method returns, i.e. after
 * the commit. If it throws, Spring retries it a few times with backoff
 * ({@code spring.rabbitmq.listener.simple.retry.*}) and then rejects it, and RabbitMQ moves it to
 * the dead-letter queue instead of redelivering it forever. A message that cannot even be read
 * (invalid JSON) goes there right away.
 */
@Component
class TodoCompletedListener {

	private static final Logger logger = LoggerFactory.getLogger(TodoCompletedListener.class);

	private final NotificationRepository repository;

	TodoCompletedListener(NotificationRepository repository) {
		this.repository = repository;
	}

	@RabbitListener(queues = MessagingConfig.NOTIFICATION_QUEUE)
	@Transactional
	public void onTodoCompleted(TodoCompletedEvent event, @Header(AmqpHeaders.MESSAGE_ID) String eventId) {
		int inserted = this.repository.insertOnce(UUID.fromString(eventId), event.ownerId(),
				NotificationResponse.TypeEnum.TODO_COMPLETED.getValue(), event.todoId(), event.title());
		if (inserted == 0) {
			// At-least-once delivery: the same event again (e.g. resent by the outbox relay)
			logger.info("Event {} was already processed, skipping", eventId);
		}
	}

}
