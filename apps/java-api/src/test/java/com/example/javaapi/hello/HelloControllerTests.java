package com.example.javaapi.hello;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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

	@Test
	void allowsConfiguredCorsOrigin() throws Exception {
		mockMvc.perform(get("/api/hello").header("Origin", "http://localhost:4200"))
			.andExpect(status().isOk())
			.andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"));
	}

	@Test
	void answersPreflightWithCacheDuration() throws Exception {
		mockMvc.perform(options("/api/hello")
				.header("Origin", "http://localhost:4200")
				.header("Access-Control-Request-Method", "DELETE"))
			.andExpect(status().isOk())
			.andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"))
			.andExpect(header().string("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE"))
			.andExpect(header().string("Access-Control-Max-Age", "3600"));
	}

	@Test
	void rejectsUnknownCorsOrigin() throws Exception {
		mockMvc.perform(get("/api/hello").header("Origin", "https://evil.example"))
			.andExpect(status().isForbidden());
	}

}
