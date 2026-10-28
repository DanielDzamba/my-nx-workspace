package com.example.javaapi.config;

import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * A {@code @Version} check that fails in the database (two requests changed the same row at the same
 * time, and the second one's {@code UPDATE ... WHERE version = ?} matched no row) is a conflict, not
 * a server error: 409 with a Problem Details body, like the explicit version check in
 * {@code TodoService#update}. Without this handler Spring would answer 500.
 * <p>
 * {@link OptimisticLockingFailureException} is Spring's translation of JPA's
 * {@code OptimisticLockException} (subclass {@code ObjectOptimisticLockingFailureException}).
 */
@RestControllerAdvice
public class OptimisticLockingExceptionHandler {

	@ExceptionHandler(OptimisticLockingFailureException.class)
	ProblemDetail handleOptimisticLockingFailure(OptimisticLockingFailureException exception) {
		return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT,
				"The resource was changed by another request in the meantime; reload it and try again");
	}

}
