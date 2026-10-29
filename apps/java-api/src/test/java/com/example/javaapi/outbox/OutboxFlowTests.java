package com.example.javaapi.outbox;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.awaitility.Awaitility.await;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestUsers;
import com.example.javaapi.TestcontainersConfiguration;
import com.example.javaapi.messaging.MessagingConfig;
import com.example.javaapi.messaging.TodoCompletedEvent;
import com.example.javaapi.messaging.UserBlockedEvent;
import com.example.javaapi.messaging.UserUnblockedEvent;

import tools.jackson.databind.json.JsonMapper;

/**
 * The producer side of the events against real PostgreSQL and RabbitMQ containers: a change writes
 * an outbox event in its transaction, the relay publishes it to the exchange. The consumers are
 * another service (notification-service), so each test binds its own temporary queue to the
 * exchange and reads what arrives there, like a consumer would.
 * <p>
 * The Spring context (database, broker, relay) is shared with other test classes, whose events may
 * still be on their way. Each test therefore uses its own user and only looks at that user's events.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class OutboxFlowTests {

	private static final String ADMIN = "auth0|outbox-admin";

	private static final Duration TIMEOUT = Duration.ofSeconds(10);

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private RabbitAdmin rabbitAdmin;

	@Autowired
	private RabbitTemplate rabbitTemplate;

	@Autowired
	private JsonMapper jsonMapper;

	@Autowired
	private Outbox outbox;

	@Autowired
	private TransactionTemplate transaction;

	private String user;

	private Queue queue;

	@BeforeEach
	void setUp() {
		this.user = "auth0|outbox-test-" + UUID.randomUUID();
		TestUsers.create(this.jdbc, this.user, ADMIN);
		// Not auto-delete (like an AnonymousQueue): that would vanish after the first receive. Durable,
		// as RabbitMQ 4 refuses transient non-exclusive queues; deleted after the test anyway.
		this.queue = new Queue("outbox-test." + UUID.randomUUID(), true, false, false);
		this.rabbitAdmin.declareQueue(this.queue);
	}

	@AfterEach
	void deleteQueue() {
		this.rabbitAdmin.deleteQueue(this.queue.getName());
	}

	private RequestPostProcessor asUser() {
		return jwt().jwt((token) -> token.subject(this.user));
	}

	private static RequestPostProcessor admin() {
		return jwt().jwt((token) -> token.subject(ADMIN)).authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
	}

	@Test
	void completingTodoPublishesTodoCompleted() throws Exception {
		listen(MessagingConfig.TODO_EVENTS_EXCHANGE, TodoCompletedEvent.TYPE);
		long id = createTodo("Buy milk");

		update(id, """
				{"title": "Buy milk", "completed": true}""");

		TodoCompletedEvent event = receive(TodoCompletedEvent.class);
		assertThat(event.todoId()).isEqualTo(id);
		assertThat(event.ownerId()).isEqualTo(this.user);
		assertThat(event.title()).isEqualTo("Buy milk");
		// The outbox row is marked (right after the broker's confirm), so the relay does not send it again
		await().atMost(TIMEOUT).until(() -> unpublishedEvents(String.valueOf(id)) == 0);
	}

	@Test
	void recordsEventOnlyWhenTodoBecomesCompleted() throws Exception {
		long id = createTodo("Buy milk");

		// Open → open, completed → completed (renamed) and completed → open: no event
		update(id, """
				{"title": "Buy oat milk"}""");
		update(id, """
				{"title": "Buy oat milk", "completed": true}""");
		update(id, """
				{"title": "Buy oat milk!", "completed": true}""");
		update(id, """
				{"title": "Buy oat milk!", "completed": false}""");

		assertThat(events(String.valueOf(id))).isEqualTo(1);
	}

	@Test
	void blockingAndUnblockingPublishUserEvents() throws Exception {
		listen(MessagingConfig.USER_EVENTS_EXCHANGE, "user.*");

		setBlocked(true);
		Message blocked = receiveMessage();
		assertThat(blocked.getMessageProperties().getReceivedRoutingKey()).isEqualTo(UserBlockedEvent.TYPE);
		assertThat(this.jsonMapper.readValue(blocked.getBody(), UserBlockedEvent.class).userId()).isEqualTo(this.user);

		// Blocking a blocked user changes nothing, so it records nothing
		setBlocked(true);
		assertThat(events(this.user)).isEqualTo(1);

		setBlocked(false);
		Message unblocked = receiveMessage();
		assertThat(unblocked.getMessageProperties().getReceivedRoutingKey()).isEqualTo(UserUnblockedEvent.TYPE);
		assertThat(this.jsonMapper.readValue(unblocked.getBody(), UserUnblockedEvent.class).userId())
			.isEqualTo(this.user);
	}

	@Test
	void outboxRequiresTheCallersTransaction() {
		// Without a surrounding transaction the event would be committed without the change it belongs to
		assertThatThrownBy(() -> this.outbox.record("Todo", 1, TodoCompletedEvent.TYPE, "{}"))
			.isInstanceOf(IllegalTransactionStateException.class);
	}

	@Test
	void rejectsAggregateTypeWithoutExchange() {
		// Fails while recording; in the relay it would block the whole batch on every run
		assertThatThrownBy(() -> this.transaction
			.executeWithoutResult((status) -> this.outbox.record("Invoice", 1, "invoice.paid", "{}")))
			.isInstanceOf(IllegalArgumentException.class);
	}

	private void listen(String exchange, String routingKey) {
		Binding binding = BindingBuilder.bind(this.queue).to(new TopicExchange(exchange)).with(routingKey);
		this.rabbitAdmin.declareBinding(binding);
	}

	/** The next message of this test's user; events of other test classes are skipped. */
	private Message receiveMessage() {
		long deadline = System.nanoTime() + TIMEOUT.toNanos();
		while (System.nanoTime() < deadline) {
			Message message = this.rabbitTemplate.receive(this.queue.getName(), TIMEOUT.toMillis());
			if (message != null && new String(message.getBody()).contains(this.user)) {
				return message;
			}
		}
		throw new AssertionError("No event for " + this.user + " within " + TIMEOUT);
	}

	private <T> T receive(Class<T> type) {
		return this.jsonMapper.readValue(receiveMessage().getBody(), type);
	}

	private long createTodo(String title) throws Exception {
		String body = mockMvc.perform(post("/api/todos").with(asUser()).contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "%s"}""".formatted(title)))
			.andExpect(status().isCreated())
			.andReturn()
			.getResponse()
			.getContentAsString();
		return this.jsonMapper.readTree(body).get("id").asLong();
	}

	private void update(long id, String json) throws Exception {
		mockMvc.perform(put("/api/todos/" + id).with(asUser()).contentType(MediaType.APPLICATION_JSON).content(json))
			.andExpect(status().isOk());
	}

	private void setBlocked(boolean blocked) throws Exception {
		mockMvc.perform(put("/api/admin/users/{id}/blocked", this.user).with(admin())
			.contentType(MediaType.APPLICATION_JSON)
			.content("{\"blocked\":" + blocked + "}")).andExpect(status().isOk());
	}

	private long events(String aggregateId) {
		return this.jdbc.queryForObject("SELECT count(*) FROM outbox_event WHERE aggregate_id = ?", Long.class,
				aggregateId);
	}

	private long unpublishedEvents(String aggregateId) {
		return this.jdbc.queryForObject(
				"SELECT count(*) FROM outbox_event WHERE aggregate_id = ? AND published_at IS NULL", Long.class,
				aggregateId);
	}

}
