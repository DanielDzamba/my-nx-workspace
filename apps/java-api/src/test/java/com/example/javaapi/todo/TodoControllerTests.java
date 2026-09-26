package com.example.javaapi.todo;

import static org.hamcrest.Matchers.hasSize;
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
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestcontainersConfiguration;

@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class TodoControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private TodoRepository repository;

	@BeforeEach
	void clearTodos() {
		this.repository.deleteAll();
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
			.andExpect(jsonPath("$.createdAt").exists());

		mockMvc.perform(get("/api/todos"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$", hasSize(1)))
			.andExpect(jsonPath("$[0].title").value("Buy milk"));
	}

	@Test
	void getsTodoById() throws Exception {
		Todo todo = this.repository.save(new Todo("Read", false));

		mockMvc.perform(get("/api/todos/{id}", todo.getId()))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.title").value("Read"));
	}

	@Test
	void updatesTodo() throws Exception {
		Todo todo = this.repository.save(new Todo("Draft", false));

		mockMvc.perform(put("/api/todos/{id}", todo.getId()).contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "Final", "completed": true}"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.title").value("Final"))
			.andExpect(jsonPath("$.completed").value(true));
	}

	@Test
	void updateWithoutCompletedKeepsIt() throws Exception {
		Todo todo = this.repository.save(new Todo("Done", true));

		mockMvc.perform(put("/api/todos/{id}", todo.getId()).contentType(MediaType.APPLICATION_JSON).content("""
				{"title": "Renamed"}"""))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.completed").value(true));
	}

	@Test
	void deletesTodo() throws Exception {
		Todo todo = this.repository.save(new Todo("Temp", false));

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
