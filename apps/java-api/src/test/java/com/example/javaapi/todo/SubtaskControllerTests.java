package com.example.javaapi.todo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
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

/** The todo detail with its subtasks and the subtask endpoints under {@code /api/todos/{id}/subtasks}. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class SubtaskControllerTests {

	private static final String ALICE = "auth0|alice";

	private static final String BOB = "auth0|bob";

	private MockMvc mockMvc;

	@Autowired
	private TodoRepository repository;

	@Autowired
	private SubtaskRepository subtaskRepository;

	private Todo todo;

	@BeforeEach
	void setUp(WebApplicationContext context) {
		this.mockMvc = MockMvcBuilders.webAppContextSetup(context)
			.apply(springSecurity())
			.defaultRequest(get("/").with(as(ALICE)))
			.build();
		this.repository.deleteAll();
		this.todo = this.repository.save(new Todo(ALICE, "Trip", false));
	}

	private static RequestPostProcessor as(String subject) {
		return jwt().jwt((token) -> token.subject(subject));
	}

	@Test
	void addsSubtasksAndShowsThemInTheDetail() throws Exception {
		mockMvc.perform(post("/api/todos/{id}/subtasks", this.todo.getId()).contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"title": "  Pack  "}"""))
			.andExpect(status().isCreated())
			.andExpect(header().exists("Location"))
			.andExpect(jsonPath("$.title").value("Pack"))
			.andExpect(jsonPath("$.completed").value(false));
		mockMvc.perform(post("/api/todos/{id}/subtasks", this.todo.getId()).contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"title": "Book hotel", "completed": true}""")).andExpect(status().isCreated());

		mockMvc.perform(get("/api/todos/{id}", this.todo.getId()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.title").value("Trip"))
			// In creation order
			.andExpect(jsonPath("$.subtasks[*].title", contains("Pack", "Book hotel")))
			.andExpect(jsonPath("$.subtasks[1].completed").value(true));
	}

	@Test
	void updatesAndDeletesASubtask() throws Exception {
		Subtask subtask = this.subtaskRepository.save(new Subtask(this.todo, "Pack", false));

		mockMvc
			.perform(put("/api/todos/{id}/subtasks/{subtaskId}", this.todo.getId(), subtask.getId())
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "Pack bags", "completed": true}"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.title").value("Pack bags"))
			.andExpect(jsonPath("$.completed").value(true));

		mockMvc.perform(delete("/api/todos/{id}/subtasks/{subtaskId}", this.todo.getId(), subtask.getId()))
			.andExpect(status().isNoContent());
		assertThat(this.subtaskRepository.count()).isZero();
	}

	@Test
	void hidesSubtasksOfOtherUsers() throws Exception {
		Subtask subtask = this.subtaskRepository.save(new Subtask(this.todo, "Pack", false));

		mockMvc.perform(post("/api/todos/{id}/subtasks", this.todo.getId()).with(as(BOB))
			.contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"title": "Sneaky"}""")).andExpect(status().isNotFound());
		mockMvc
			.perform(put("/api/todos/{id}/subtasks/{subtaskId}", this.todo.getId(), subtask.getId()).with(as(BOB))
				.contentType(MediaType.APPLICATION_JSON)
				.content("""
						{"title": "Hacked"}"""))
			.andExpect(status().isNotFound());
		mockMvc
			.perform(delete("/api/todos/{id}/subtasks/{subtaskId}", this.todo.getId(), subtask.getId()).with(as(BOB)))
			.andExpect(status().isNotFound());

		assertThat(this.subtaskRepository.findAll()).extracting(Subtask::getTitle).containsExactly("Pack");
	}

	@Test
	void findsASubtaskOnlyUnderItsOwnTodo() throws Exception {
		Subtask subtask = this.subtaskRepository.save(new Subtask(this.todo, "Pack", false));
		Todo other = this.repository.save(new Todo(ALICE, "Other", false));

		mockMvc.perform(delete("/api/todos/{id}/subtasks/{subtaskId}", other.getId(), subtask.getId()))
			.andExpect(status().isNotFound());
	}

	@Test
	void deletingATodoDeletesItsSubtasks() throws Exception {
		this.subtaskRepository.save(new Subtask(this.todo, "Pack", false));

		mockMvc.perform(delete("/api/todos/{id}", this.todo.getId())).andExpect(status().isNoContent());

		assertThat(this.subtaskRepository.count()).isZero();
	}

	@Test
	void rejectsBlankSubtaskTitle() throws Exception {
		mockMvc.perform(post("/api/todos/{id}/subtasks", this.todo.getId()).contentType(MediaType.APPLICATION_JSON)
			.content("""
					{"title": " "}""")).andExpect(status().isBadRequest());
	}

}
