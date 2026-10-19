package com.example.javaapi.config;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * The signed-in user of the current request. The API interfaces generated from the contract have no
 * parameter for the token, so controllers read it from the security context instead of
 * {@code @AuthenticationPrincipal Jwt}.
 */
public final class CurrentUser {

	private CurrentUser() {
	}

	/** Auth0 user ID: the {@code sub} claim of the validated access token. */
	public static String id() {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		if (authentication instanceof JwtAuthenticationToken token) {
			return token.getToken().getSubject();
		}
		// Unreachable for /api/**: SecurityConfig rejects requests without a valid token with 401
		throw new IllegalStateException("Not authenticated with a JWT");
	}

}
