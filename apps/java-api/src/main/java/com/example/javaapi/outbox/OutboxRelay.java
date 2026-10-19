package com.example.javaapi.outbox;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.example.javaapi.messaging.MessagingConfig;

/**
 * Publishes the outbox to RabbitMQ: every {@code app.outbox.relay-interval} it takes the oldest
 * unpublished events, sends them, waits until the broker confirms it has stored them (publisher
 * confirms) and only then marks them as published, in one transaction.
 * <p>
 * Delivery is <b>at least once</b>: if the app dies after the broker confirmed but before the
 * commit, the events are sent again on the next run. Consumers must therefore be idempotent (the
 * event ID is the message ID). If the broker is down, nothing is marked and the events wait.
 * <p>
 * {@code FOR UPDATE SKIP LOCKED}: with several app instances, each relay locks its own rows and
 * skips the ones another instance is sending, so no event is sent twice by two relays at once.
 */
@Component
class OutboxRelay {

	private static final Logger logger = LoggerFactory.getLogger(OutboxRelay.class);

	private static final int BATCH_SIZE = 100;

	private static final Duration CONFIRM_TIMEOUT = Duration.ofSeconds(10);

	private final JdbcClient jdbc;

	private final RabbitTemplate rabbitTemplate;

	private final Duration retention;

	OutboxRelay(JdbcClient jdbc, RabbitTemplate rabbitTemplate,
			@Value("${app.outbox.retention}") Duration retention) {
		this.jdbc = jdbc;
		this.rabbitTemplate = rabbitTemplate;
		this.retention = retention;
	}

	@Scheduled(fixedDelayString = "${app.outbox.relay-interval}")
	@Transactional
	public void publishPending() {
		List<PendingEvent> events = this.jdbc.sql("""
				SELECT id, event_type, payload::text AS payload
				FROM outbox_event
				WHERE published_at IS NULL
				ORDER BY created_at
				LIMIT :limit
				FOR UPDATE SKIP LOCKED
				""").param("limit", BATCH_SIZE).query(PendingEvent.class).list();
		if (events.isEmpty()) {
			return;
		}
		try {
			// invoke: all sends and the confirm wait run on one channel
			this.rabbitTemplate.invoke((operations) -> {
				events.forEach((event) -> operations.send(MessagingConfig.TODO_EVENTS_EXCHANGE, event.eventType(),
						toMessage(event)));
				operations.waitForConfirmsOrDie(CONFIRM_TIMEOUT.toMillis());
				return null;
			});
		}
		catch (RuntimeException ex) {
			// Rolls back; the events stay unpublished and are retried on the next run
			logger.warn("Publishing {} outbox events failed, retrying later: {}", events.size(), ex.getMessage());
			throw ex;
		}
		this.jdbc.sql("UPDATE outbox_event SET published_at = now() WHERE id IN (:ids)")
			.param("ids", events.stream().map(PendingEvent::id).toList())
			.update();
		logger.debug("Published {} outbox events", events.size());
	}

	/** Published events are only kept for troubleshooting. */
	@Scheduled(cron = "${app.outbox.cleanup-cron}")
	@Transactional
	public void deletePublished() {
		int deleted = this.jdbc.sql("DELETE FROM outbox_event WHERE published_at < now() - make_interval(secs => :seconds)")
			.param("seconds", this.retention.toSeconds())
			.update();
		logger.info("Deleted {} published outbox events older than {}", deleted, this.retention);
	}

	private static Message toMessage(PendingEvent event) {
		return MessageBuilder.withBody(event.payload().getBytes(StandardCharsets.UTF_8))
			.setContentType(MessageProperties.CONTENT_TYPE_JSON)
			.setContentEncoding(StandardCharsets.UTF_8.name())
			.setMessageId(event.id().toString())
			.setType(event.eventType())
			.build();
	}

	record PendingEvent(UUID id, String eventType, String payload) {
	}

}
