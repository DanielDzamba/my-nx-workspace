package com.example.javaapi.messaging;

import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.ExchangeBuilder;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * RabbitMQ topology of the producer side: one exchange per kind of entity, the routing key is the
 * event type. Spring declares them on the broker when the first connection opens (existing ones
 * with the same settings are left alone).
 *
 * <pre>
 * OutboxRelay ──"todo.completed"──────────────► todo.events (topic) ──► queues of the consumers
 *             ──"user.blocked" / "user.unblocked"──► user.events (topic) ──►
 * </pre>
 *
 * This app declares no queues: every consumer (today notification-service, see its
 * MessagingConfig) declares and binds its own queue and dead-letter queue. A new consumer (e.g.
 * statistics) therefore needs no change here.
 */
@Configuration
@EnableScheduling
public class MessagingConfig {

	/** Exchange for all events about todos. */
	public static final String TODO_EVENTS_EXCHANGE = "todo.events";

	/** Exchange for all events about users. */
	public static final String USER_EVENTS_EXCHANGE = "user.events";

	@Bean
	Declarables eventExchanges() {
		return new Declarables(ExchangeBuilder.topicExchange(TODO_EVENTS_EXCHANGE).durable(true).build(),
				ExchangeBuilder.topicExchange(USER_EVENTS_EXCHANGE).durable(true).build());
	}

	/**
	 * The exchange for events about an aggregate type of the outbox.
	 * @throws IllegalArgumentException for a type without an exchange
	 */
	public static String exchangeFor(String aggregateType) {
		return switch (aggregateType) {
			case "Todo" -> TODO_EVENTS_EXCHANGE;
			case "User" -> USER_EVENTS_EXCHANGE;
			default -> throw new IllegalArgumentException("No exchange for aggregate type " + aggregateType);
		};
	}

	/** Message bodies are JSON. */
	@Bean
	MessageConverter jsonMessageConverter() {
		return new JacksonJsonMessageConverter();
	}

}
