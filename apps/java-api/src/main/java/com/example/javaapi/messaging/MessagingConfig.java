package com.example.javaapi.messaging;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.ExchangeBuilder;
import org.springframework.amqp.core.FanoutExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * RabbitMQ topology. Spring declares it on the broker when the first connection opens (existing
 * exchanges and queues with the same settings are left alone):
 *
 * <pre>
 * OutboxRelay ──"todo.completed"──► todo.events (topic) ──► notification.todo-completed ──► TodoCompletedListener
 *                                                                    │ rejected after the retries
 *                                                                    ▼
 *                                                todo.events.dlx (fanout) ──► notification.todo-completed.dlq
 * </pre>
 *
 * Producers only know the exchange and the routing key, consumers only their queue: a new consumer
 * (e.g. statistics) binds its own queue to the exchange without any change on the producer side.
 */
@Configuration
@EnableScheduling
public class MessagingConfig {

	/** Exchange for all events about todos; the routing key is the event type. */
	public static final String TODO_EVENTS_EXCHANGE = "todo.events";

	public static final String NOTIFICATION_QUEUE = "notification.todo-completed";

	/** Messages the consumer gave up on land here for a human to look at (dead-letter queue). */
	public static final String NOTIFICATION_DEAD_LETTER_QUEUE = NOTIFICATION_QUEUE + ".dlq";

	static final String DEAD_LETTER_EXCHANGE = TODO_EVENTS_EXCHANGE + ".dlx";

	@Bean
	Declarables todoEventsTopology() {
		TopicExchange events = ExchangeBuilder.topicExchange(TODO_EVENTS_EXCHANGE).durable(true).build();
		FanoutExchange deadLetters = ExchangeBuilder.fanoutExchange(DEAD_LETTER_EXCHANGE).durable(true).build();
		// Durable queues and persistent messages (the default) survive a broker restart
		Queue notifications = QueueBuilder.durable(NOTIFICATION_QUEUE)
			.deadLetterExchange(DEAD_LETTER_EXCHANGE)
			.build();
		Queue notificationDeadLetters = QueueBuilder.durable(NOTIFICATION_DEAD_LETTER_QUEUE).build();
		Binding notificationsBinding = BindingBuilder.bind(notifications)
			.to(events)
			.with(TodoCompletedEvent.TYPE);
		Binding deadLettersBinding = BindingBuilder.bind(notificationDeadLetters).to(deadLetters);
		return new Declarables(events, deadLetters, notifications, notificationDeadLetters, notificationsBinding,
				deadLettersBinding);
	}

	/** Message bodies are JSON; listeners get them converted to their parameter type. */
	@Bean
	MessageConverter jsonMessageConverter() {
		return new JacksonJsonMessageConverter();
	}

}
