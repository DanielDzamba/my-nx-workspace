package com.example.javaapi.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

/**
 * The API is an OAuth2 resource server: every /api request needs a valid Auth0 access token
 * (`Authorization: Bearer <JWT>`). Issuer and audience are checked from
 * `spring.security.oauth2.resourceserver.jwt.*` in application.properties.
 */
@Configuration
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		return http
			.authorizeHttpRequests((requests) -> requests
				// Render health check and liveness/readiness probes call these without a token
				.requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
				// Spring Boot renders error responses (e.g. 400, 404) on /error
				.requestMatchers("/error").permitAll()
				.requestMatchers("/api/**").authenticated()
				.anyRequest().denyAll())
			// Uses the CORS mappings from CorsConfig, so a preflight (OPTIONS, never has a token)
			// is answered before authentication would reject it with 401
			.cors(Customizer.withDefaults())
			.oauth2ResourceServer((resourceServer) -> resourceServer.jwt(Customizer.withDefaults()))
			// No session and no cookies: the token is sent on every request, so CSRF does not apply
			.sessionManagement((session) -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.csrf(AbstractHttpConfigurer::disable)
			.build();
	}

}
