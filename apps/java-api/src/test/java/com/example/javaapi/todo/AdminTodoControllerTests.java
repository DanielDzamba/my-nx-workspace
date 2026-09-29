package com.example.javaapi.todo;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestcontainersConfiguration;

/**
 * 401 vs 403 on the admin overview. {@code authorities(...)} sets what SecurityConfig maps from
 * the roles claim (that mapping is covered by {@code SecurityConfigTests}).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class AdminTodoControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private TodoRepository repository;

	@BeforeEach
	void setUp() {
		this.repository.deleteAll();
	}

	@Test
	void rejectsRequestWithoutToken() throws Exception {
		// 401: not authenticated, we do not know who is asking
		mockMvc.perform(get("/api/admin/todos")).andExpect(status().isUnauthorized());
	}

	@Test
	void forbidsUsersWithoutAdminRole() throws Exception {
		// 403: authenticated, but not allowed
		mockMvc.perform(get("/api/admin/todos").with(jwt())).andExpect(status().isForbidden());
	}

	@Test
	void listsTodosOfAllUsersForAdmin() throws Exception {
		this.repository.save(new Todo("auth0|alice", "Alice todo", false));
		this.repository.save(new Todo("auth0|bob", "Bob todo", true));

		mockMvc.perform(get("/api/admin/todos").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(2)))
			// Newest first
			.andExpect(jsonPath("$.content[0].title").value("Bob todo"))
			.andExpect(jsonPath("$.content[0].ownerId").value("auth0|bob"))
			.andExpect(jsonPath("$.content[1].ownerId").value("auth0|alice"))
			.andExpect(jsonPath("$.page.size").value(20))
			.andExpect(jsonPath("$.page.totalElements").value(2));
	}

	@Test
	void pagesTheOverview() throws Exception {
		for (int i = 1; i <= 3; i++) {
			this.repository.save(new Todo("auth0|user" + i, "Todo " + i, false));
		}

		mockMvc
			.perform(get("/api/admin/todos").param("size", "2")
				.param("page", "1")
				.param("sort", "title,asc")
				.with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].title").value("Todo 3"))
			.andExpect(jsonPath("$.page.number").value(1))
			.andExpect(jsonPath("$.page.totalPages").value(2));
	}

}
