package com.example.javaapi.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestcontainersConfiguration;

/**
 * Redis is down: the API keeps working, only slower, because CacheConfig's error handler turns
 * cache failures into cache misses. The property gives this test class its own application context
 * and so its own containers, whose Redis it can stop without affecting other tests.
 */
@SpringBootTest(properties = "spring.data.redis.timeout=200ms")
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class RedisOutageTests {

	private static final String ALICE = "auth0|alice";

	@Autowired
	private GenericContainer<?> redisContainer;

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbc;

	@BeforeEach
	void setUp() {
		this.redisContainer.stop();
		this.jdbc.update("DELETE FROM todo");
		this.jdbc.update("DELETE FROM users");
	}

	@Test
	void provisionsAndBlocksUsersWithoutTheCache() throws Exception {
		mockMvc.perform(get("/api/todos").with(jwt().jwt((token) -> token.subject(ALICE))))
			.andExpect(status().isOk());
		assertThat(this.jdbc.queryForObject("SELECT count(*) FROM users WHERE id = ?", Long.class, ALICE))
			.isOne();

		mockMvc
			.perform(put("/api/admin/users/{id}/blocked", ALICE)
				.with(jwt().jwt((token) -> token.subject("auth0|admin"))
					.authorities(new SimpleGrantedAuthority("ROLE_ADMIN")))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"blocked\":true}"))
			.andExpect(status().isOk());

		// Every request reads the database, so the block is seen at once
		mockMvc.perform(get("/api/todos").with(jwt().jwt((token) -> token.subject(ALICE))))
			.andExpect(status().isForbidden());
	}

}
