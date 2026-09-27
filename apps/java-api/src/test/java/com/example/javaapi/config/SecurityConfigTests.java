package com.example.javaapi.config;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestcontainersConfiguration;

/**
 * Which endpoints need a token. {@code jwt()} stands in for a token that already passed signature,
 * issuer and audience validation, so no request goes to Auth0.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class SecurityConfigTests {

	@Autowired
	private MockMvc mockMvc;

	@Test
	void rejectsApiRequestWithoutToken() throws Exception {
		mockMvc.perform(get("/api/todos"))
			.andExpect(status().isUnauthorized())
			.andExpect(header().string("WWW-Authenticate", startsWith("Bearer")));
	}

	@Test
	void allowsApiRequestWithToken() throws Exception {
		mockMvc.perform(get("/api/todos").with(jwt())).andExpect(status().isOk());
	}

	@Test
	void answersPreflightWithoutToken() throws Exception {
		mockMvc.perform(options("/api/todos")
				.header("Origin", "http://localhost:4200")
				.header("Access-Control-Request-Method", "GET")
				.header("Access-Control-Request-Headers", "authorization"))
			.andExpect(status().isOk())
			.andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"));
	}

	@Test
	void exposesHealthAndInfoWithoutToken() throws Exception {
		mockMvc.perform(get("/actuator/health/liveness")).andExpect(status().isOk());
		mockMvc.perform(get("/actuator/health/readiness")).andExpect(status().isOk());
		mockMvc.perform(get("/actuator/info")).andExpect(status().isOk());
	}

	@Test
	void deniesEverythingElse() throws Exception {
		mockMvc.perform(get("/actuator/env")).andExpect(status().isUnauthorized());
		mockMvc.perform(get("/actuator/env").with(jwt())).andExpect(status().isForbidden());
	}

}
