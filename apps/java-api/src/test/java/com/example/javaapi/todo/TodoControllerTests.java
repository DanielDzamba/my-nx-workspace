package com.example.javaapi.todo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestcontainersConfiguration;

/**
 * Todo API behaviour for a signed-in user. Requests without a token are covered by
 * {@code SecurityConfigTests}.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class TodoControllerTests {

	private static final String ALICE = "auth0|alice";

	private static final String BOB = "auth0|bob";

	private MockMvc mockMvc;

	@Autowired
	private TodoRepository repository;

	@BeforeEach
	void setUp(WebApplicationContext context) {
		// Unless a test says otherwise, requests come from Alice with a mocked, already validated
		// JWT (no Auth0 call)
		this.mockMvc = MockMvcBuilders.webAppContextSetup(context)
			.apply(springSecurity())
			.defaultRequest(get("/").with(as(ALICE)))
			.build();
		this.repository.deleteAll();
	}

	/** A token whose {@code sub} claim is {@code subject}. */
	private static RequestPostProcessor as(String subject) {
		return jwt().jwt((token) -> token.subject(subject));
	}

	@Test
	void createsAndListsTodos() throws Exception {
		mockMvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "  Buy milk  "}"""))
			.andExpect(status().isCreated())
			.andExpect(header().exists("Location"))
			.andExpect(jsonPath("$.id").isNumber())
			.andExpect(jsonPath("$.title").value("Buy milk"))
			.andExpect(jsonPath("$.completed").value(false))
			.andExpect(jsonPath("$.createdAt").exists())
			// Users only ever see their own todos, so the owner is not repeated
			.andExpect(jsonPath("$.ownerId").doesNotExist());

		mockMvc.perform(get("/api/todos"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].title").value("Buy milk"));
	}

	@Test
	void takesOwnerFromTokenNotFromBody() throws Exception {
		mockMvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "Mine", "ownerId": "auth0|bob"}""")).andExpect(status().isCreated());

		assertThat(this.repository.findAll()).extracting(Todo::getOwnerId).containsExactly(ALICE);
	}

	@Test
	void listsOnlyOwnTodos() throws Exception {
		this.repository.save(new Todo(ALICE, "Alice todo", false));
		this.repository.save(new Todo(BOB, "Bob todo", false));

		mockMvc.perform(get("/api/todos"))
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].title").value("Alice todo"));
		mockMvc.perform(get("/api/todos").with(as(BOB)))
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].title").value("Bob todo"));
	}

	@Test
	void hidesTodosOfOtherUsers() throws Exception {
		Todo todo = this.repository.save(new Todo(ALICE, "Private", false));

		// Bob knows (or guesses) the ID: he gets the same answer as for an ID that does not exist
		mockMvc.perform(get("/api/todos/{id}", todo.getId()).with(as(BOB))).andExpect(status().isNotFound());
		mockMvc.perform(put("/api/todos/{id}", todo.getId()).with(as(BOB))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"title": "Hacked", "completed": true}""")).andExpect(status().isNotFound());
		mockMvc.perform(delete("/api/todos/{id}", todo.getId()).with(as(BOB))).andExpect(status().isNotFound());

		Todo unchanged = this.repository.findById(todo.getId()).orElseThrow();
		assertThat(unchanged.getTitle()).isEqualTo("Private");
		assertThat(unchanged.isCompleted()).isFalse();
	}

	@Test
	void getsTodoById() throws Exception {
		Todo todo = this.repository.save(new Todo(ALICE, "Read", false));

		mockMvc.perform(get("/api/todos/{id}", todo.getId()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.title").value("Read"));
	}

	@Test
	void updatesTodo() throws Exception {
		Todo todo = this.repository.save(new Todo(ALICE, "Draft", false));

		mockMvc.perform(put("/api/todos/{id}", todo.getId()).contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "Final", "completed": true}"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.title").value("Final"))
			.andExpect(jsonPath("$.completed").value(true));
	}

	@Test
	void updateWithoutCompletedKeepsIt() throws Exception {
		Todo todo = this.repository.save(new Todo(ALICE, "Done", true));

		mockMvc.perform(put("/api/todos/{id}", todo.getId()).contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "Renamed"}"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.completed").value(true));
	}

	@Test
	void deletesTodo() throws Exception {
		Todo todo = this.repository.save(new Todo(ALICE, "Temp", false));

		mockMvc.perform(delete("/api/todos/{id}", todo.getId())).andExpect(status().isNoContent());
		mockMvc.perform(get("/api/todos/{id}", todo.getId())).andExpect(status().isNotFound());
	}

	@Test
	void returnsNotFoundForUnknownTodo() throws Exception {
		mockMvc.perform(get("/api/todos/{id}", 999_999)).andExpect(status().isNotFound());
		mockMvc.perform(put("/api/todos/{id}", 999_999).contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "x"}""")).andExpect(status().isNotFound());
		mockMvc.perform(delete("/api/todos/{id}", 999_999)).andExpect(status().isNotFound());
	}

	@Test
	void rejectsBlankOrTooLongTitle() throws Exception {
		mockMvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "   "}""")).andExpect(status().isBadRequest());
		mockMvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON)
			.content("{\"title\": \"" + "a".repeat(201) + "\"}")).andExpect(status().isBadRequest());
	}

}
