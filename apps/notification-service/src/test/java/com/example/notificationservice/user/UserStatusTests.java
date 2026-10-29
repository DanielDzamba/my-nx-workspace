package com.example.notificationservice.user;

import static org.awaitility.Awaitility.await;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
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
import com.example.notificationservice.messaging.UserStatusEvent;

import tools.jackson.databind.json.JsonMapper;

/** Blocking as java-api reports it through {@code user.blocked} / {@code user.unblocked} events. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class UserStatusTests {

	private static final Duration TIMEOUT = Duration.ofSeconds(10);

	private static final Instant T1 = Instant.parse("2026-10-29T10:00:00Z");

	private static final Instant T2 = Instant.parse("2026-10-29T11:00:00Z");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private RabbitTemplate rabbitTemplate;

	@Autowired
	private UserStatusRepository userStatus;

	@Autowired
	private JsonMapper jsonMapper;

	private String user;

	@BeforeEach
	void setUp() {
		this.user = "auth0|user-status-test-" + UUID.randomUUID();
	}

	private RequestPostProcessor asUser() {
		return jwt().jwt((token) -> token.subject(this.user));
	}

	@Test
	void blockedUserGetsTheSameProblemAsFromJavaApi() throws Exception {
		mockMvc.perform(get("/api/notifications").with(asUser())).andExpect(status().isOk());

		publish(UserStatusEvent.BLOCKED, T1);
		await().atMost(TIMEOUT).until(() -> this.userStatus.isBlocked(this.user));

		mockMvc.perform(get("/api/notifications").with(asUser()))
			.andExpect(status().isForbidden())
			.andExpect(jsonPath("$.type").value(BlockedUserFilter.USER_BLOCKED_TYPE.toString()));
	}

	@Test
	void unblockedUserCanUseTheApiAgain() throws Exception {
		publish(UserStatusEvent.BLOCKED, T1);
		await().atMost(TIMEOUT).until(() -> this.userStatus.isBlocked(this.user));

		publish(UserStatusEvent.UNBLOCKED, T2);
		await().atMost(TIMEOUT).until(() -> !this.userStatus.isBlocked(this.user));

		mockMvc.perform(get("/api/notifications").with(asUser())).andExpect(status().isOk());
	}

	@Test
	void ignoresAnOlderEventThatArrivesLate() {
		publish(UserStatusEvent.BLOCKED, T2);
		await().atMost(TIMEOUT).until(() -> this.userStatus.isBlocked(this.user));

		// The unblock happened before the block, but arrives after it (e.g. it was retried)
		publish(UserStatusEvent.UNBLOCKED, T1);

		await().during(Duration.ofSeconds(1)).atMost(TIMEOUT).until(() -> this.userStatus.isBlocked(this.user));
	}

	private void publish(String type, Instant occurredAt) {
		this.rabbitTemplate.send(MessagingConfig.USER_EVENTS_EXCHANGE, type,
				TestEvents.message(this.jsonMapper, UUID.randomUUID(), new UserStatusEvent(this.user, occurredAt)));
	}

}
