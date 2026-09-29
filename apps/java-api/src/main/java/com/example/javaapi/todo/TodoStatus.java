package com.example.javaapi.todo;

import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** The {@code status} filter of the todo list. */
public enum TodoStatus {

	ALL, ACTIVE, COMPLETED;

	/** Parses the query parameter case-insensitively ({@code ?status=active}); unknown values are a 400. */
	static TodoStatus fromParam(String value) {
		try {
			return valueOf(value.strip().toUpperCase(Locale.ROOT));
		}
		catch (IllegalArgumentException ex) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown status: " + value);
		}
	}

}
