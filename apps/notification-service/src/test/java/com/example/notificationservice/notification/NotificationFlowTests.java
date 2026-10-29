package com.example.notificationservice.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.notificationservice.TestEvents;
import com.example.notificationservice.TestcontainersConfiguration;
import com.example.notificationservice.messaging.MessagingConfig;
import com.example.notificationservice.messaging.TodoCompletedEvent;

import tools.jackson.databind.json.JsonMapper;

/**
 * From a {@code TodoCompleted} event, as java-api publishes it, to the REST API, against real
 * PostgreSQL and RabbitMQ containers. The listener runs on another thread, so the tests wait for
 * the result (Awaitility). Each test uses its own user, so events of other tests cannot interfere.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class NotificationFlowTests {

	private static final Duration TIMEOUT = Duration.ofSeconds(10);

	private static final Instant COMPLETED_AT = Instant.parse("2026-10-29T12:00:00Z");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private RabbitTemplate rabbitTemplate;

	@Autowired
	private NotificationRepository notifications;

	@Autowired
	private JsonMapper jsonMapper;

	private String owner;

	@BeforeEach
	void setUp() {
		this.owner = "auth0|notification-test-" + UUID.randomUUID();
	}

	private static RequestPostProcessor as(String subject) {
		return jwt().jwt((token) -> token.subject(subject));
	}

	@Test
	void completedTodoBecomesNotificationOfItsOwner() throws Exception {
		publish(UUID.randomUUID(), new TodoCompletedEvent(42, this.owner, "Buy milk", COMPLETED_AT));

		await().atMost(TIMEOUT).until(() -> ownNotifications() == 1);
		mockMvc.perform(get("/api/notifications").with(as(this.owner)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.unreadCount").value(1))
			.andExpect(jsonPath("$.items", hasSize(1)))
			.andExpect(jsonPath("$.items[0].type").value("TODO_COMPLETED"))
			.andExpect(jsonPath("$.items[0].todoId").value(42))
			.andExpect(jsonPath("$.items[0].todoTitle").value("Buy milk"))
			.andExpect(jsonPath("$.items[0].read").value(false));

		// Nobody else sees them
		mockMvc.perform(get("/api/notifications").with(as("auth0|bob")))
			.andExpect(jsonPath("$.unreadCount").value(0))
			.andExpect(jsonPath("$.items", hasSize(0)));
	}

	@Test
	void marksAllNotificationsAsRead() throws Exception {
		publish(UUID.randomUUID(), new TodoCompletedEvent(1, this.owner, "One", COMPLETED_AT));
		await().atMost(TIMEOUT).until(() -> ownNotifications() == 1);
		publish(UUID.randomUUID(), new TodoCompletedEvent(2, this.owner, "Two", COMPLETED_AT));
		await().atMost(TIMEOUT).until(() -> ownNotifications() == 2);

		mockMvc.perform(post("/api/notifications/read-all").with(as(this.owner))).andExpect(status().isNoContent());

		mockMvc.perform(get("/api/notifications").with(as(this.owner)))
			.andExpect(jsonPath("$.unreadCount").value(0))
			.andExpect(jsonPath("$.items", hasSize(2)))
			.andExpect(jsonPath("$.items[0].todoTitle").value("Two"))
			.andExpect(jsonPath("$.items[0].read").value(true));
	}

	@Test
	void processesTheSameEventOnlyOnce() {
		// At-least-once delivery: e.g. java-api's relay crashed after the broker confirmed and resent it
		UUID eventId = UUID.randomUUID();
		TodoCompletedEvent event = new TodoCompletedEvent(42, this.owner, "Buy milk", COMPLETED_AT);

		publish(eventId, event);
		publish(eventId, event);

		await().atMost(TIMEOUT).until(() -> ownNotifications() == 1);
		// Give the second delivery time to be processed (and skipped)
		await().during(Duration.ofSeconds(1)).atMost(TIMEOUT).until(() -> ownNotifications() == 1);
	}

	@Test
	void movesUnreadableMessageToDeadLetterQueue() {
		Message poison = MessageBuilder.withBody("not json".getBytes(StandardCharsets.UTF_8))
			.setContentType(MessageProperties.CONTENT_TYPE_JSON)
			.setMessageId(UUID.randomUUID().toString())
			.build();

		this.rabbitTemplate.send(MessagingConfig.TODO_EVENTS_EXCHANGE, TodoCompletedEvent.TYPE, poison);

		// A conversion error is fatal: retrying cannot fix the body, so it is rejected right away
		Message deadLetter = this.rabbitTemplate.receive(MessagingConfig.TODO_COMPLETED_DEAD_LETTER_QUEUE,
				Duration.ofSeconds(20).toMillis());
		assertThat(deadLetter).isNotNull();
		assertThat(new String(deadLetter.getBody(), StandardCharsets.UTF_8)).isEqualTo("not json");
	}

	private void publish(UUID eventId, TodoCompletedEvent event) {
		this.rabbitTemplate.send(MessagingConfig.TODO_EVENTS_EXCHANGE, TodoCompletedEvent.TYPE,
				TestEvents.message(this.jsonMapper, eventId, event));
	}

	private int ownNotifications() {
		return this.notifications.findTop20ByRecipientIdOrderByCreatedAtDescIdDesc(this.owner).size();
	}

}
