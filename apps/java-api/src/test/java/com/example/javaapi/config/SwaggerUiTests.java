package com.example.javaapi.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springdoc.webmvc.api.OpenApiResource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestcontainersConfiguration;

/** Swagger UI shows the API contract and is reachable without a token; the API itself is not. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class SwaggerUiTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void servesTheContract() throws Exception {
		mockMvc.perform(get("/openapi.yaml"))
			.andExpect(status().isOk())
			.andExpect(content().string(containsString("title: Todo API")));
	}

	@Test
	void swaggerUiLoadsTheContract() throws Exception {
		mockMvc.perform(get("/swagger-ui/index.html")).andExpect(status().isOk());
		mockMvc.perform(get("/v3/api-docs/swagger-config"))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.url").value("/openapi.yaml"));
	}

	@Test
	void doesNotGenerateASpecFromTheCode(ApplicationContext context) {
		// The contract is the only spec: no /v3/api-docs endpoint scanning the controllers
		assertThat(context.getBeansOfType(OpenApiResource.class)).isEmpty();
	}

}
