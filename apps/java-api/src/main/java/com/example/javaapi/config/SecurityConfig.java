package com.example.javaapi.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * The API is an OAuth2 resource server: every /api request needs a valid Auth0 access token
 * (`Authorization: Bearer <JWT>`). Issuer and audience are checked from
 * `spring.security.oauth2.resourceserver.jwt.*` in application.properties.
 * <p>
 * Authentication (who are you?) fails with 401, authorization (may you do this?) with 403.
 * Role checks are {@code @PreAuthorize} annotations on the controllers ({@code @EnableMethodSecurity}).
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

	/**
	 * Custom claim with the user's Auth0 roles (e.g. {@code ["ADMIN"]}), added to the tokens by a
	 * Post-Login Action. Auth0 requires custom claims to be namespaced with a URL.
	 */
	public static final String ROLES_CLAIM = "https://todo-api/roles";

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
			.oauth2ResourceServer((resourceServer) -> resourceServer
				.jwt((jwt) -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())))
			// No session and no cookies: the token is sent on every request, so CSRF does not apply
			.sessionManagement((session) -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.csrf(AbstractHttpConfigurer::disable)
			.build();
	}

	/**
	 * Turns the roles claim into Spring authorities: {@code "ADMIN"} becomes {@code ROLE_ADMIN},
	 * which {@code hasRole('ADMIN')} checks. The principal stays the {@link org.springframework.security.oauth2.jwt.Jwt}.
	 */
	static JwtAuthenticationConverter jwtAuthenticationConverter() {
		JwtGrantedAuthoritiesConverter roles = new JwtGrantedAuthoritiesConverter();
		roles.setAuthoritiesClaimName(ROLES_CLAIM);
		roles.setAuthorityPrefix("ROLE_");

		JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
		converter.setJwtGrantedAuthoritiesConverter(roles);
		return converter;
	}

}
