package com.example.notificationservice.user;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

import com.example.notificationservice.messaging.MessagingConfig;
import com.example.notificationservice.messaging.UserStatusEvent;

/**
 * Keeps {@code user_status} in sync with java-api's {@code user.blocked} / {@code user.unblocked}
 * events. Retries and the dead-letter queue work as for {@code TodoCompletedListener}.
 */
@Component
class UserStatusListener {

	private static final Logger logger = LoggerFactory.getLogger(UserStatusListener.class);

	private final UserStatusRepository repository;

	UserStatusListener(UserStatusRepository repository) {
		this.repository = repository;
	}

	@RabbitListener(queues = MessagingConfig.USER_STATUS_QUEUE)
	public void onUserStatusChanged(UserStatusEvent event, @Header(AmqpHeaders.RECEIVED_ROUTING_KEY) String type) {
		boolean blocked = switch (type) {
			case UserStatusEvent.BLOCKED -> true;
			case UserStatusEvent.UNBLOCKED -> false;
			// Only these two keys are bound (MessagingConfig); anything else is a bug, so dead-letter it
			default -> throw new IllegalArgumentException("Unexpected user event " + type);
		};
		if (this.repository.save(event.userId(), blocked, event.occurredAt()) == 0) {
			logger.info("Skipping {} for {}: a newer change is stored already", type, event.userId());
		}
	}

}
