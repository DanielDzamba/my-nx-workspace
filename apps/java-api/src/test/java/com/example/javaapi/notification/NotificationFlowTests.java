package com.example.javaapi.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestcontainersConfiguration;
import com.example.javaapi.messaging.MessagingConfig;
import com.example.javaapi.messaging.TodoCompletedEvent;
import com.example.javaapi.outbox.Outbox;

import tools.jackson.databind.json.JsonMapper;

/**
 * The whole asynchronous flow against real PostgreSQL and RabbitMQ containers: completing a todo
 * writes an outbox event, the relay publishes it, the listener stores a notification. The steps run
 * on other threads after the request has returned, so the tests wait for the result (Awaitility).
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class NotificationFlowTests {

	private static final String ALICE = "auth0|alice";

	private static final String BOB = "auth0|bob";

	private static final Duration TIMEOUT = Duration.ofSeconds(10);

	private MockMvc mockMvc;

	@Autowired
	private JdbcClient jdbc;

	@Autowired
	private RabbitTemplate rabbitTemplate;

	@Autowired
	private NotificationRepository notifications;

	@Autowired
	private JsonMapper jsonMapper;

	@Autowired
	private Outbox outbox;

	@BeforeEach
	void setUp(WebApplicationContext context) {
		this.mockMvc = MockMvcBuilders.webAppContextSetup(context)
			.apply(springSecurity())
			.defaultRequest(get("/").with(as(ALICE)))
			.build();
		this.jdbc.sql("DELETE FROM todo").update();
		this.jdbc.sql("DELETE FROM outbox_event").update();
		this.jdbc.sql("DELETE FROM notification").update();
	}

	private static RequestPostProcessor as(String subject) {
		return jwt().jwt((token) -> token.subject(subject));
	}

	@Test
	void completingTodoNotifiesItsOwner() throws Exception {
		long id = createTodo("Buy milk");

		complete(id, "Buy milk");

		await().atMost(TIMEOUT).until(() -> this.notifications.count() == 1);
		mockMvc.perform(get("/api/notifications"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.unreadCount").value(1))
			.andExpect(jsonPath("$.items", hasSize(1)))
			.andExpect(jsonPath("$.items[0].type").value("TODO_COMPLETED"))
			.andExpect(jsonPath("$.items[0].todoId").value(id))
			.andExpect(jsonPath("$.items[0].todoTitle").value("Buy milk"))
			.andExpect(jsonPath("$.items[0].read").value(false));
		// The outbox row is marked (right after the broker's confirm), so the relay does not send it again
		await().atMost(TIMEOUT).until(() -> unpublishedEvents() == 0);

		// Bob does not see Alice's notifications
		mockMvc.perform(get("/api/notifications").with(as(BOB)))
			.andExpect(jsonPath("$.unreadCount").value(0))
			.andExpect(jsonPath("$.items", hasSize(0)));
	}

	@Test
	void marksAllNotificationsAsRead() throws Exception {
		complete(createTodo("One"), "One");
		complete(createTodo("Two"), "Two");
		await().atMost(TIMEOUT).until(() -> this.notifications.count() == 2);

		mockMvc.perform(post("/api/notifications/read-all")).andExpect(status().isNoContent());

		mockMvc.perform(get("/api/notifications"))
			.andExpect(jsonPath("$.unreadCount").value(0))
			.andExpect(jsonPath("$.items", hasSize(2)))
			.andExpect(jsonPath("$.items[0].todoTitle").value("Two"))
			.andExpect(jsonPath("$.items[0].read").value(true));
	}

	@Test
	void recordsEventOnlyWhenTodoBecomesCompleted() throws Exception {
		long id = createTodo("Buy milk");

		// Open → open, completed → completed (renamed) and completed → open: no event
		update(id, """
				{"title": "Buy oat milk"}""");
		complete(id, "Buy oat milk");
		update(id, """
				{"title": "Buy oat milk!", "completed": true}""");
		update(id, """
				{"title": "Buy oat milk!", "completed": false}""");

		assertThat(this.jdbc.sql("SELECT count(*) FROM outbox_event").query(Long.class).single()).isEqualTo(1);
		// Let it arrive, so it cannot show up in the next test
		await().atMost(TIMEOUT).until(() -> this.notifications.count() == 1);
	}

	@Test
	void outboxRequiresTheCallersTransaction() {
		// Without a surrounding transaction the event would be committed without the change it belongs to
		assertThatThrownBy(() -> this.outbox.record("Todo", 1, TodoCompletedEvent.TYPE, "{}"))
			.isInstanceOf(IllegalTransactionStateException.class);
	}

	@Test
	void processesTheSameEventOnlyOnce() {
		// At-least-once delivery: e.g. the relay crashed after the broker confirmed and resent it
		Message message = eventMessage(UUID.randomUUID(),
				new TodoCompletedEvent(42, ALICE, "Buy milk", Instant.parse("2026-10-19T12:00:00Z")));

		this.rabbitTemplate.send(MessagingConfig.TODO_EVENTS_EXCHANGE, TodoCompletedEvent.TYPE, message);
		this.rabbitTemplate.send(MessagingConfig.TODO_EVENTS_EXCHANGE, TodoCompletedEvent.TYPE, message);

		await().atMost(TIMEOUT).until(() -> this.notifications.count() == 1);
		// Give the second delivery time to be processed (and skipped)
		await().during(Duration.ofSeconds(1)).atMost(TIMEOUT).until(() -> this.notifications.count() == 1);
	}

	@Test
	void movesUnreadableMessageToDeadLetterQueue() {
		Message poison = MessageBuilder.withBody("not json".getBytes(StandardCharsets.UTF_8))
			.setContentType(MessageProperties.CONTENT_TYPE_JSON)
			.setMessageId(UUID.randomUUID().toString())
			.build();

		this.rabbitTemplate.send(MessagingConfig.TODO_EVENTS_EXCHANGE, TodoCompletedEvent.TYPE, poison);

		// A conversion error is fatal: retrying cannot fix the body, so it is rejected right away
		Message deadLetter = this.rabbitTemplate.receive(MessagingConfig.NOTIFICATION_DEAD_LETTER_QUEUE,
				Duration.ofSeconds(20).toMillis());
		assertThat(deadLetter).isNotNull();
		assertThat(new String(deadLetter.getBody(), StandardCharsets.UTF_8)).isEqualTo("not json");
		assertThat(this.notifications.count()).isZero();
	}

	private Message eventMessage(UUID eventId, TodoCompletedEvent event) {
		return MessageBuilder.withBody(this.jsonMapper.writeValueAsBytes(event))
			.setContentType(MessageProperties.CONTENT_TYPE_JSON)
			.setMessageId(eventId.toString())
			.build();
	}

	private long createTodo(String title) throws Exception {
		String body = mockMvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "%s"}""".formatted(title)))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return this.jsonMapper.readTree(body).get("id").asLong();
	}

	private void complete(long id, String title) throws Exception {
		update(id, """
				{"title": "%s", "completed": true}""".formatted(title));
	}

	private void update(long id, String json) throws Exception {
		mockMvc.perform(put("/api/todos/" + id).contentType(MediaType.APPLICATION_JSON).content(json))
			.andExpect(status().isOk());
	}

	private long unpublishedEvents() {
		return this.jdbc.sql("SELECT count(*) FROM outbox_event WHERE published_at IS NULL").query(Long.class).single();
	}

}
