package com.example.notificationservice.user;

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
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.servlet.HandlerExceptionResolver;

/**
 * Answers 403 on every {@code /api} request of a blocked user, right after the access token is
 * validated (see SecurityConfig). The answer is the same as java-api's (status, problem type), so
 * the frontend shows its "account blocked" page whichever service answered.
 * <p>
 * Not a {@code @Component}: Spring Boot would also register a filter bean in the servlet container,
 * where it would run a second time outside the security filter chain.
 */
public class BlockedUserFilter extends OncePerRequestFilter {

	/** Problem type of the 403 for a blocked user; the same URI as in java-api. */
	public static final URI USER_BLOCKED_TYPE = URI.create("https://todo-api/problems/user-blocked");

	private final UserStatusRepository userStatus;

	private final HandlerExceptionResolver exceptionResolver;

	/**
	 * @param exceptionResolver Spring MVC's resolver: renders the 403 as Problem Details like the
	 * errors thrown in controllers, although a filter runs outside Spring MVC
	 */
	public BlockedUserFilter(UserStatusRepository userStatus, HandlerExceptionResolver exceptionResolver) {
		this.userStatus = userStatus;
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
		if (authentication instanceof JwtAuthenticationToken token
				&& this.userStatus.isBlocked(token.getToken().getSubject())) {
			this.exceptionResolver.resolveException(request, response, null, userBlocked());
			return;
		}
		chain.doFilter(request, response);
	}

	private static ErrorResponseException userBlocked() {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN,
				"Your account has been blocked by an administrator.");
		problem.setType(USER_BLOCKED_TYPE);
		problem.setTitle("Account blocked");
		return new ErrorResponseException(HttpStatus.FORBIDDEN, problem, null);
	}

}
