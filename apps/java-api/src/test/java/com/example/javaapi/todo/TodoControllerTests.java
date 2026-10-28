package com.example.javaapi.todo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestUsers;
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

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private TransactionTemplate transaction;

	@BeforeEach
	void setUp(WebApplicationContext context) {
		// Unless a test says otherwise, requests come from Alice with a mocked, already validated
		// JWT (no Auth0 call)
		this.mockMvc = MockMvcBuilders.webAppContextSetup(context)
			.apply(springSecurity())
			.defaultRequest(get("/").with(as(ALICE)))
			.build();
		this.repository.deleteAll();
		TestUsers.create(this.jdbc, ALICE, BOB);
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
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].title").value("Buy milk"))
			.andExpect(jsonPath("$.content[0].subtaskCount").value(0))
			.andExpect(jsonPath("$.page.totalElements").value(1));
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
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].title").value("Alice todo"));
		mockMvc.perform(get("/api/todos").with(as(BOB)))
			.andExpect(jsonPath("$.content", hasSize(1)))
			.andExpect(jsonPath("$.content[0].title").value("Bob todo"));
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
	void newTodoStartsAtVersionZero() throws Exception {
		mockMvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "New"}""")).andExpect(jsonPath("$.version").value(0));
	}

	@Test
	void updateWithCurrentVersionIncrementsIt() throws Exception {
		Todo todo = this.repository.save(new Todo(ALICE, "Draft", false));

		mockMvc.perform(put("/api/todos/{id}", todo.getId()).contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "Final", "version": 0}"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.title").value("Final"))
			// The client sends this one with its next change
			.andExpect(jsonPath("$.version").value(1));
		mockMvc.perform(get("/api/todos/{id}", todo.getId())).andExpect(jsonPath("$.version").value(1));
		mockMvc.perform(get("/api/todos")).andExpect(jsonPath("$.content[0].version").value(1));
	}

	/**
	 * Lost update: tab A renames the todo, tab B still shows the old state and ticks "completed".
	 * B's request carries the version it edited, so it is rejected instead of reverting A's rename.
	 */
	@Test
	void rejectsUpdateBasedOnOutdatedVersion() throws Exception {
		Todo todo = this.repository.save(new Todo(ALICE, "Old title", false));
		mockMvc.perform(put("/api/todos/{id}", todo.getId()).contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "Renamed in tab A", "version": 0}""")).andExpect(status().isOk());

		mockMvc.perform(put("/api/todos/{id}", todo.getId()).contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "Old title", "completed": true, "version": 0}"""))
			.andExpect(status().isConflict())
			.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(409));

		Todo unchanged = this.repository.findById(todo.getId()).orElseThrow();
		assertThat(unchanged.getTitle()).isEqualTo("Renamed in tab A");
		assertThat(unchanged.isCompleted()).isFalse();
		assertThat(unchanged.getVersion()).isEqualTo(1);
	}

	/** Clients that do not send a version yet (e.g. a cached old frontend) work as before. */
	@Test
	void updateWithoutVersionOverwritesAsBefore() throws Exception {
		Todo todo = this.repository.save(new Todo(ALICE, "Draft", false));
		this.jdbc.update("UPDATE todo SET version = 5 WHERE id = ?", todo.getId());

		mockMvc.perform(put("/api/todos/{id}", todo.getId()).contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "Final"}"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.title").value("Final"))
			.andExpect(jsonPath("$.version").value(6));
	}

	/**
	 * Two requests change the same todo at the same time: both pass the version check, the second
	 * UPDATE finds the row at a newer version. Simulated in one transaction: the todo is loaded
	 * (version 0), then the row is changed behind Hibernate's back, then the request runs and gets
	 * the already loaded, now outdated todo.
	 */
	@Test
	void answersConflictWhenTodoChangesBetweenCheckAndCommit() {
		Todo saved = this.repository.save(new Todo(ALICE, "Draft", false));

		this.transaction.executeWithoutResult((status) -> {
			this.repository.findById(saved.getId()).orElseThrow();
			this.jdbc.update("UPDATE todo SET title = 'Concurrent', version = version + 1 WHERE id = ?", saved.getId());
			try {
				mockMvc.perform(put("/api/todos/{id}", saved.getId()).contentType(MediaType.APPLICATION_JSON)
					.content("""
							{"title": "Final", "version": 0}"""))
					.andExpect(status().isConflict())
					.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON));
			}
			catch (Exception ex) {
				throw new IllegalStateException(ex);
			}
			status.setRollbackOnly();
		});
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

	/** Error bodies are RFC 9457 Problem Details, as the contract declares. */
	@Test
	void describesErrorsAsProblemDetails() throws Exception {
		mockMvc.perform(get("/api/todos/{id}", 999_999))
			.andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(404))
			.andExpect(jsonPath("$.detail").value("Todo 999999 not found"));
		mockMvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON).content("""
				{"title": ""}""")).andExpect(content().contentType(MediaType.APPLICATION_PROBLEM_JSON))
			.andExpect(jsonPath("$.status").value(400));
	}

	@Test
	void rejectsBlankOrTooLongTitle() throws Exception {
		mockMvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "   "}""")).andExpect(status().isBadRequest());
		mockMvc.perform(post("/api/todos").contentType(MediaType.APPLICATION_JSON)
			.content("{\"title\": \"" + "a".repeat(201) + "\"}")).andExpect(status().isBadRequest());
	}

}
