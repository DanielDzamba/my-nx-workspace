package com.example.javaapi.todo;

import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Checks and completes the {@code ?page=&size=&sort=} parameters of the todo lists. */
final class TodoPaging {

	/**
	 * Sorting by any other property would either fail (unknown property) or sort by a column
	 * nobody expects, so the client may only choose from these.
	 */
	static final Set<String> SORTABLE = Set.of("createdAt", "title");

	private TodoPaging() {
	}

	/**
	 * Rejects unknown sort properties and adds {@code id} as the last sort key. Without a unique
	 * last key, rows with the same {@code createdAt} or {@code title} may come back in a different
	 * order on every query, so a row could appear on two pages or on none.
	 */
	static Pageable withStableSort(Pageable pageable) {
		Sort sort = pageable.getSort();
		Sort.Direction lastDirection = Sort.Direction.ASC;
		for (Sort.Order order : sort) {
			if (!SORTABLE.contains(order.getProperty())) {
				throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot sort by " + order.getProperty());
			}
			lastDirection = order.getDirection();
		}
		return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(),
				sort.and(Sort.by(lastDirection, "id")));
	}

}
