package com.example.javaapi.todo;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestcontainersConfiguration;

/** Paging, filtering and sorting of {@code GET /api/todos}. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class TodoListControllerTests {

	private static final String ALICE = "auth0|alice";

	private MockMvc mockMvc;

	@Autowired
	private TodoRepository repository;

	@Autowired
	private SubtaskRepository subtaskRepository;

	@BeforeEach
	void setUp(WebApplicationContext context) {
		this.mockMvc = MockMvcBuilders.webAppContextSetup(context)
			.apply(springSecurity())
			.defaultRequest(get("/").with(jwt().jwt((token) -> token.subject(ALICE))))
			.build();
		this.repository.deleteAll();
	}

	/** Saved one after another, so the creation time grows with the argument order. */
	private void saveTodos(String... titles) {
		for (String title : titles) {
			this.repository.save(new Todo(ALICE, title, title.startsWith("Done")));
		}
	}

	@Test
	void returnsNewestFirstInPagesOfTen() throws Exception {
		for (int i = 1; i <= 12; i++) {
			saveTodos("Todo " + i);
		}

		mockMvc.perform(get("/api/todos"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.content.length()").value(10))
			.andExpect(jsonPath("$.content[0].title").value("Todo 12"))
			.andExpect(jsonPath("$.page.size").value(10))
			.andExpect(jsonPath("$.page.number").value(0))
			.andExpect(jsonPath("$.page.totalElements").value(12))
			.andExpect(jsonPath("$.page.totalPages").value(2));

		mockMvc.perform(get("/api/todos").param("page", "1"))
			.andExpect(jsonPath("$.content[*].title", contains("Todo 2", "Todo 1")));
	}

	@Test
	void capsThePageSize() throws Exception {
		mockMvc.perform(get("/api/todos").param("size", "100000")).andExpect(jsonPath("$.page.size").value(100));
	}

	@Test
	void filtersByStatus() throws Exception {
		saveTodos("Open", "Done A", "Done B");

		mockMvc.perform(get("/api/todos").param("status", "active"))
			.andExpect(jsonPath("$.content[*].title", contains("Open")));
		mockMvc.perform(get("/api/todos").param("status", "completed"))
			.andExpect(jsonPath("$.content[*].title", contains("Done B", "Done A")))
			.andExpect(jsonPath("$.page.totalElements").value(2));
	}

	@Test
	void searchesTitlesCaseInsensitively() throws Exception {
		saveTodos("Buy MILK", "Milkshake", "Bread");

		mockMvc.perform(get("/api/todos").param("q", " milk "))
			.andExpect(jsonPath("$.content[*].title", contains("Milkshake", "Buy MILK")));
	}

	@Test
	void treatsLikeWildcardsInTheSearchAsText() throws Exception {
		saveTodos("100% done", "1000 steps", "snake_case", "snakecase");

		mockMvc.perform(get("/api/todos").param("q", "0%"))
			.andExpect(jsonPath("$.content[*].title", contains("100% done")));
		mockMvc.perform(get("/api/todos").param("q", "e_c"))
			.andExpect(jsonPath("$.content[*].title", contains("snake_case")));
	}

	@Test
	void combinesFilters() throws Exception {
		saveTodos("Milk", "Done milk", "Done bread");

		mockMvc.perform(get("/api/todos").param("status", "completed").param("q", "milk"))
			.andExpect(jsonPath("$.content[*].title", contains("Done milk")));
		mockMvc.perform(get("/api/todos").param("status", "active").param("q", "bread"))
			.andExpect(jsonPath("$.content", empty()));
	}

	@Test
	void sortsByTitle() throws Exception {
		saveTodos("Banana", "Apple", "Cherry");

		mockMvc.perform(get("/api/todos").param("sort", "title,asc"))
			.andExpect(jsonPath("$.content[*].title", contains("Apple", "Banana", "Cherry")));
		mockMvc.perform(get("/api/todos").param("sort", "title,desc"))
			.andExpect(jsonPath("$.content[*].title", contains("Cherry", "Banana", "Apple")));
		mockMvc.perform(get("/api/todos").param("sort", "createdAt,asc"))
			.andExpect(jsonPath("$.content[*].title", contains("Banana", "Apple", "Cherry")));
	}

	@Test
	void rejectsUnknownSortPropertyAndStatus() throws Exception {
		mockMvc.perform(get("/api/todos").param("sort", "ownerId,asc")).andExpect(status().isBadRequest());
		mockMvc.perform(get("/api/todos").param("status", "later")).andExpect(status().isBadRequest());
	}

	@Test
	void countsSubtasksPerTodo() throws Exception {
		saveTodos("Empty");
		Todo trip = this.repository.save(new Todo(ALICE, "Trip", false));
		this.subtaskRepository.save(new Subtask(trip, "Pack", true));
		this.subtaskRepository.save(new Subtask(trip, "Book hotel", false));

		mockMvc.perform(get("/api/todos"))
			.andExpect(jsonPath("$.content[0].title").value("Trip"))
			.andExpect(jsonPath("$.content[0].subtaskCount").value(2))
			.andExpect(jsonPath("$.content[0].completedSubtaskCount").value(1))
			.andExpect(jsonPath("$.content[1].subtaskCount").value(0));
	}

}
