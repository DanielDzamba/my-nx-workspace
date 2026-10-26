package com.example.javaapi.user;

import java.io.IOException;
import java.net.URI;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * Runs on every {@code /api} request right after the access token is validated (see SecurityConfig):
 * <ol>
 * <li>creates the user on their first request, and updates name and email when the token has new
 * ones (just-in-time provisioning);</li>
 * <li>answers 403 for a blocked user, before any controller runs.</li>
 * </ol>
 * The profile comes from the cache ({@link UserService#findProfile}), so a normal request neither
 * reads nor writes the {@code users} table.
 * <p>
 * Not a {@code @Component}: Spring Boot would also register a filter bean in the servlet container,
 * where it would run a second time outside the security filter chain.
 */
public class UserProvisioningFilter extends OncePerRequestFilter {

	/** Custom claims with the user's name and email, added to the access token by the Auth0 Post-Login Action. */
	public static final String NAME_CLAIM = "https://todo-api/name";

	public static final String EMAIL_CLAIM = "https://todo-api/email";

	/** Problem type of the 403 for a blocked user; the frontend recognizes a blocked account by it. */
	public static final URI USER_BLOCKED_TYPE = URI.create("https://todo-api/problems/user-blocked");

	private final UserService users;

	private final HandlerExceptionResolver exceptionResolver;

	/**
	 * @param exceptionResolver Spring MVC's resolver: renders the 403 as Problem Details like the
	 * errors thrown in controllers, although a filter runs outside Spring MVC
	 */
	public UserProvisioningFilter(UserService users, HandlerExceptionResolver exceptionResolver) {
		this.users = users;
		this.exceptionResolver = exceptionResolver;
	}

	@Override
	protected boolean shouldNotFilter(HttpServletRequest request) {
		return !request.getRequestURI().startsWith(request.getContextPath() + "/api/");
	}

	@Override
	protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
			throws ServletException, IOException {
		Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
		// No token: nothing to do here, authorization answers 401 later in the chain
		if (authentication instanceof JwtAuthenticationToken token) {
			UserProfile profile = provision(token.getToken());
			// Provisioning never changes `blocked`, and a new user (no profile yet) is not blocked
			if (profile != null && profile.blocked()) {
				this.exceptionResolver.resolveException(request, response, null, userBlocked());
				return;
			}
		}
		chain.doFilter(request, response);
	}

	/** @return the profile as it was before this request, {@code null} for a new user */
	private UserProfile provision(Jwt token) {
		String name = token.getClaimAsString(NAME_CLAIM);
		String email = token.getClaimAsString(EMAIL_CLAIM);
		UserProfile profile = this.users.findProfile(token.getSubject()).orElse(null);
		if (profile == null || profile.differsFrom(name, email)) {
			this.users.provision(token.getSubject(), name, email);
		}
		return profile;
	}

	private static ErrorResponseException userBlocked() {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN,
				"Your account has been blocked by an administrator.");
		problem.setType(USER_BLOCKED_TYPE);
		problem.setTitle("Account blocked");
		return new ErrorResponseException(HttpStatus.FORBIDDEN, problem, null);
	}

}
