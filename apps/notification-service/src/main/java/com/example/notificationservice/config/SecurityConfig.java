package com.example.notificationservice.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.servlet.HandlerExceptionResolver;

import com.example.notificationservice.user.BlockedUserFilter;
import com.example.notificationservice.user.UserStatusRepository;

/**
 * An OAuth2 resource server like java-api: every /api request needs a valid Auth0 access token, and
 * this service checks it on its own (signature against Auth0's public keys, issuer, audience from
 * `spring.security.oauth2.resourceserver.jwt.*`), without asking java-api. The same token works for
 * both services because both accept the audience {@code https://todo-api}.
 * <p>
 * There are no role checks here: a user only ever sees their own notifications.
 */
@Configuration
public class SecurityConfig {

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http, UserStatusRepository userStatus,
			@Qualifier("handlerExceptionResolver") HandlerExceptionResolver exceptionResolver) throws Exception {
		return http
			.authorizeHttpRequests((requests) -> requests
				// Health check and liveness/readiness probes call these without a token
				.requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
				// Spring Boot renders error responses (e.g. 400, 404) on /error
				.requestMatchers("/error").permitAll()
				// The API contract and Swagger UI; the API calls made from Swagger UI still need a token
				.requestMatchers("/openapi.yaml", "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/swagger-config")
				.permitAll()
				.requestMatchers("/api/**").authenticated()
				.anyRequest().denyAll())
			// Uses the CORS mappings from CorsConfig, so a preflight (OPTIONS, never has a token)
			// is answered before authentication would reject it with 401
			.cors(Customizer.withDefaults())
			.oauth2ResourceServer((resourceServer) -> resourceServer.jwt(Customizer.withDefaults()))
			// Right after the token is validated: reject a user that java-api reported as blocked
			.addFilterAfter(new BlockedUserFilter(userStatus, exceptionResolver), BearerTokenAuthenticationFilter.class)
			// No session and no cookies: the token is sent on every request, so CSRF does not apply
			.sessionManagement((session) -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.csrf(AbstractHttpConfigurer::disable)
			.build();
	}

}
