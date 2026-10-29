package com.example.notificationservice.messaging;

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

/**
 * The queues of this service. java-api (the producer) only knows its exchanges; every consumer
 * declares and binds its own queues, so the producer does not change when a consumer is added.
 * Spring declares everything when the first connection opens; existing exchanges and queues with
 * the same settings are left alone, so both services may declare the exchanges.
 *
 * <pre>
 * java-api ──"todo.completed"──► todo.events ──► notification.todo-completed ──► TodoCompletedListener
 *                                                     │ rejected after the retries
 *                                                     ▼
 *                                   todo.events.dlx ──► notification.todo-completed.dlq
 *
 * java-api ──"user.blocked"────► user.events ──► notification.user-status ──► UserStatusListener
 *          ──"user.unblocked"──►                      │ rejected after the retries
 *                                                     ▼
 *                                        (default exchange) ──► notification.user-status.dlq
 * </pre>
 *
 * The first queue existed before this service (in java-api), so its arguments stay exactly as they
 * were: RabbitMQ refuses to redeclare a queue with different arguments, and keeping the name means
 * no event is lost when the consumer moves. The new queue sends its dead letters straight to its
 * own DLQ through the default exchange, so it shares no dead-letter exchange with other consumers.
 */
@Configuration
public class MessagingConfig {

	/** Exchange of java-api for all events about todos; the routing key is the event type. */
	public static final String TODO_EVENTS_EXCHANGE = "todo.events";

	/** Exchange of java-api for all events about users. */
	public static final String USER_EVENTS_EXCHANGE = "user.events";

	public static final String TODO_COMPLETED_QUEUE = "notification.todo-completed";

	/** Messages the consumer gave up on land here for a human to look at (dead-letter queue). */
	public static final String TODO_COMPLETED_DEAD_LETTER_QUEUE = TODO_COMPLETED_QUEUE + ".dlq";

	public static final String USER_STATUS_QUEUE = "notification.user-status";

	public static final String USER_STATUS_DEAD_LETTER_QUEUE = USER_STATUS_QUEUE + ".dlq";

	static final String TODO_DEAD_LETTER_EXCHANGE = TODO_EVENTS_EXCHANGE + ".dlx";

	@Bean
	Declarables todoCompletedTopology() {
		TopicExchange events = ExchangeBuilder.topicExchange(TODO_EVENTS_EXCHANGE).durable(true).build();
		FanoutExchange deadLetters = ExchangeBuilder.fanoutExchange(TODO_DEAD_LETTER_EXCHANGE).durable(true).build();
		// Durable queues and persistent messages (the default) survive a broker restart
		Queue queue = QueueBuilder.durable(TODO_COMPLETED_QUEUE).deadLetterExchange(TODO_DEAD_LETTER_EXCHANGE).build();
		Queue deadLetterQueue = QueueBuilder.durable(TODO_COMPLETED_DEAD_LETTER_QUEUE).build();
		return new Declarables(events, deadLetters, queue, deadLetterQueue,
				BindingBuilder.bind(queue).to(events).with(TodoCompletedEvent.TYPE),
				BindingBuilder.bind(deadLetterQueue).to(deadLetters));
	}

	@Bean
	Declarables userStatusTopology() {
		TopicExchange events = ExchangeBuilder.topicExchange(USER_EVENTS_EXCHANGE).durable(true).build();
		Queue queue = QueueBuilder.durable(USER_STATUS_QUEUE)
			.deadLetterExchange("")
			.deadLetterRoutingKey(USER_STATUS_DEAD_LETTER_QUEUE)
			.build();
		Queue deadLetterQueue = QueueBuilder.durable(USER_STATUS_DEAD_LETTER_QUEUE).build();
		Binding blocked = BindingBuilder.bind(queue).to(events).with(UserStatusEvent.BLOCKED);
		Binding unblocked = BindingBuilder.bind(queue).to(events).with(UserStatusEvent.UNBLOCKED);
		return new Declarables(events, queue, deadLetterQueue, blocked, unblocked);
	}

	/** Message bodies are JSON; listeners get them converted to their parameter type. */
	@Bean
	MessageConverter jsonMessageConverter() {
		return new JacksonJsonMessageConverter();
	}

}
