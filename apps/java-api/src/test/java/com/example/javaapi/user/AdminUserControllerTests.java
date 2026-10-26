package com.example.javaapi.user;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestUsers;
import com.example.javaapi.TestcontainersConfiguration;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class AdminUserControllerTests {

	private static final String ADMIN = "auth0|admin";

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private CacheManager cacheManager;

	@BeforeEach
	void setUp() {
		this.jdbc.update("DELETE FROM todo");
		this.jdbc.update("DELETE FROM users");
		this.cacheManager.getCache(UserService.CACHE).clear();
	}

	private static RequestPostProcessor admin() {
		return jwt().jwt((token) -> token.subject(ADMIN)).authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
	}

	private static String blocked(boolean blocked) {
		return "{\"blocked\":" + blocked + "}";
	}

	@Test
	void rejectsRequestWithoutToken() throws Exception {
		mockMvc.perform(get("/api/admin/users")).andExpect(status().isUnauthorized());
		mockMvc.perform(put("/api/admin/users/{id}/blocked", "auth0|bob")
			.contentType(MediaType.APPLICATION_JSON)
			.content(blocked(true))).andExpect(status().isUnauthorized());
	}

	@Test
	void forbidsUsersWithoutAdminRole() throws Exception {
		mockMvc.perform(get("/api/admin/users").with(jwt())).andExpect(status().isForbidden());
		mockMvc.perform(put("/api/admin/users/{id}/blocked", "auth0|bob").with(jwt())
			.contentType(MediaType.APPLICATION_JSON)
			.content(blocked(true))).andExpect(status().isForbidden());
	}

	@Test
	void listsUsersNewestFirstAndPaged() throws Exception {
		TestUsers.create(this.jdbc, "auth0|first");
		TestUsers.create(this.jdbc, "auth0|second");
		this.jdbc.update("UPDATE users SET name = 'Second', email = 'second@example.com' WHERE id = 'auth0|second'");

		// The admin's own request creates the admin as the newest user
		mockMvc.perform(get("/api/admin/users").param("size", "2").with(admin()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(2)))
			.andExpect(jsonPath("$.content[0].id").value(ADMIN))
			.andExpect(jsonPath("$.content[1].id").value("auth0|second"))
			.andExpect(jsonPath("$.content[1].name").value("Second"))
			.andExpect(jsonPath("$.content[1].email").value("second@example.com"))
			.andExpect(jsonPath("$.content[1].blocked").value(false))
			.andExpect(jsonPath("$.page.totalElements").value(3))
			.andExpect(jsonPath("$.page.totalPages").value(2));
	}

	@Test
	void blockingIsIdempotent() throws Exception {
		TestUsers.create(this.jdbc, "auth0|bob");

		for (int i = 0; i < 2; i++) {
			mockMvc.perform(put("/api/admin/users/{id}/blocked", "auth0|bob").with(admin())
				.contentType(MediaType.APPLICATION_JSON)
				.content(blocked(true))).andExpect(status().isOk()).andExpect(jsonPath("$.blocked").value(true));
		}
	}

	@Test
	void answers404ForUnknownUser() throws Exception {
		mockMvc.perform(put("/api/admin/users/{id}/blocked", "auth0|nobody").with(admin())
			.contentType(MediaType.APPLICATION_JSON)
			.content(blocked(true))).andExpect(status().isNotFound());
	}

	@Test
	void adminCannotBlockThemselves() throws Exception {
		mockMvc.perform(put("/api/admin/users/{id}/blocked", ADMIN).with(admin())
			.contentType(MediaType.APPLICATION_JSON)
			.content(blocked(true))).andExpect(status().isConflict());
	}

	@Test
	void rejectsBodyWithoutBlocked() throws Exception {
		TestUsers.create(this.jdbc, "auth0|bob");

		mockMvc.perform(put("/api/admin/users/{id}/blocked", "auth0|bob").with(admin())
			.contentType(MediaType.APPLICATION_JSON)
			.content("{}")).andExpect(status().isBadRequest());
	}

}
