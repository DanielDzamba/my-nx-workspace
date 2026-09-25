package com.example.javaapi.hello;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(HelloController.class)
class HelloControllerTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void returnsDefaultGreeting() throws Exception {
		mockMvc.perform(get("/api/hello"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.message").value("Hello, world!"));
	}

	@Test
	void greetsByName() throws Exception {
		mockMvc.perform(get("/api/hello").param("name", "Nx"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.message").value("Hello, Nx!"));
	}

}
