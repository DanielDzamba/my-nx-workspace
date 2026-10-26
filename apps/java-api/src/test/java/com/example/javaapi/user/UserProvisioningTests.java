package com.example.javaapi.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Import;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestcontainersConfiguration;

/**
 * The user filter on real PostgreSQL and Redis: provisioning on the first request, the profile
 * served from the cache, and blocking (which only works because the cache entry is evicted).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class UserProvisioningTests {

	private static final String ALICE = "auth0|alice";

	private static final String ADMIN = "auth0|admin";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private CacheManager cacheManager;

	@Autowired
	private StringRedisTemplate redis;

	@BeforeEach
	void setUp() {
		this.jdbc.update("DELETE FROM todo");
		this.jdbc.update("DELETE FROM users");
		// The cache would otherwise still know the users deleted above
		this.cacheManager.getCache(UserService.CACHE).clear();
	}

	private static RequestPostProcessor as(String subject, Map<String, Object> claims) {
		return jwt().jwt((token) -> token.subject(subject).claims((all) -> all.putAll(claims)));
	}

	private static RequestPostProcessor alice(String name, String email) {
		return as(ALICE, Map.of(UserProvisioningFilter.NAME_CLAIM, name, UserProvisioningFilter.EMAIL_CLAIM, email));
	}

	private static RequestPostProcessor admin() {
		return jwt().jwt((token) -> token.subject(ADMIN)).authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
	}

	private Map<String, Object> userRow(String id) {
		return this.jdbc.queryForMap("SELECT name, email, blocked FROM users WHERE id = ?", id);
	}

	@Test
	void createsUserOnFirstRequest() throws Exception {
		mockMvc.perform(get("/api/todos").with(alice("Alice", "alice@example.com"))).andExpect(status().isOk());

		assertThat(userRow(ALICE)).containsEntry("name", "Alice")
			.containsEntry("email", "alice@example.com")
			.containsEntry("blocked", false);
	}

	@Test
	void updatesNameAndEmailWhenTheTokenHasNewOnes() throws Exception {
		mockMvc.perform(get("/api/todos").with(alice("Alice", "alice@example.com")));

		mockMvc.perform(get("/api/todos").with(alice("Alice Smith", "alice@smith.com"))).andExpect(status().isOk());

		assertThat(userRow(ALICE)).containsEntry("name", "Alice Smith").containsEntry("email", "alice@smith.com");
	}

	@Test
	void keepsNameAndEmailWhenTheTokenHasNone() throws Exception {
		mockMvc.perform(get("/api/todos").with(alice("Alice", "alice@example.com")));

		mockMvc.perform(get("/api/todos").with(as(ALICE, Map.of()))).andExpect(status().isOk());

		assertThat(userRow(ALICE)).containsEntry("name", "Alice").containsEntry("email", "alice@example.com");
	}

	@Test
	void createsTheUserBeforeTheirFirstTodo() throws Exception {
		// todo.owner_id references users: the filter must have created the user before the insert
		mockMvc
			.perform(post("/api/todos").with(as("auth0|new", Map.of()))
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"title\":\"First\"}"))
			.andExpect(status().isCreated());
	}

	@Test
	void servesTheProfileFromRedis() throws Exception {
		String key = "java-api:users::" + ALICE;
		// First request: user unknown (empty results are not cached), then created (evicts the key)
		mockMvc.perform(get("/api/todos").with(alice("Alice", "alice@example.com")));
		assertThat(this.redis.hasKey(key)).isFalse();

		// Second request: cache miss, read from the database, stored in Redis as JSON
		mockMvc.perform(get("/api/todos").with(alice("Alice", "alice@example.com")));
		assertThat(this.redis.opsForValue().get(key)).contains("\"name\":\"Alice\"").contains("\"blocked\":false");
		assertThat(this.redis.getExpire(key)).isBetween(1L, 300L);

		// Changed behind the app's back: no eviction, so requests still see the cached profile.
		// That is why every change in UserService evicts the entry.
		this.jdbc.update("UPDATE users SET blocked = TRUE WHERE id = ?", ALICE);
		mockMvc.perform(get("/api/todos").with(alice("Alice", "alice@example.com"))).andExpect(status().isOk());
	}

	@Test
	void blockedUserIsRejectedOnTheNextRequest() throws Exception {
		// Two requests: the second one puts the profile into the cache (see servesTheProfileFromRedis)
		mockMvc.perform(get("/api/todos").with(alice("Alice", "alice@example.com"))).andExpect(status().isOk());
		mockMvc.perform(get("/api/todos").with(alice("Alice", "alice@example.com"))).andExpect(status().isOk());
		assertThat(this.redis.hasKey("java-api:users::" + ALICE)).isTrue();

		mockMvc
			.perform(put("/api/admin/users/{id}/blocked", ALICE).with(admin())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"blocked\":true}"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.blocked").value(true));

		mockMvc.perform(get("/api/todos").with(alice("Alice", "alice@example.com")))
			.andExpect(status().isForbidden())
			.andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.type").value(UserProvisioningFilter.USER_BLOCKED_TYPE.toString()))
			.andExpect(jsonPath("$.status").value(403));

		mockMvc
			.perform(put("/api/admin/users/{id}/blocked", ALICE).with(admin())
				.contentType(MediaType.APPLICATION_JSON)
				.content("{\"blocked\":false}"))
			.andExpect(status().isOk());

		mockMvc.perform(get("/api/todos").with(alice("Alice", "alice@example.com"))).andExpect(status().isOk());
	}

	@Test
	void leavesRequestsWithoutTokenToAuthorization() throws Exception {
		mockMvc.perform(get("/api/todos")).andExpect(status().isUnauthorized());

		assertThat(this.jdbc.queryForObject("SELECT count(*) FROM users", Long.class)).isZero();
	}

}
