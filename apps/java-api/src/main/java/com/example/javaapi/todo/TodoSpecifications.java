package com.example.javaapi.todo;

import java.util.Locale;

import org.springframework.data.jpa.domain.Specification;

/**
 * Building blocks of the todo list query. Only the filters that are set become part of the SQL,
 * so every combination gets a simple WHERE clause that the planner can match to an index
 * (unlike one static query with {@code (:param IS NULL OR ...)} for every filter).
 */
final class TodoSpecifications {

	private static final char LIKE_ESCAPE = '\\';

	private TodoSpecifications() {
	}

	static Specification<Todo> ownedBy(String ownerId) {
		return (root, query, cb) -> cb.equal(root.get("ownerId"), ownerId);
	}

	static Specification<Todo> hasStatus(TodoStatus status) {
		return switch (status) {
			case ALL -> Specification.unrestricted();
			case ACTIVE -> (root, query, cb) -> cb.isFalse(root.get("completed"));
			case COMPLETED -> (root, query, cb) -> cb.isTrue(root.get("completed"));
		};
	}

	/**
	 * Case-insensitive substring search: {@code lower(title) LIKE '%text%'}, backed by the trigram
	 * index on {@code lower(title)} (V4 migration).
	 */
	static Specification<Todo> titleContains(String text) {
		if (text == null || text.isBlank()) {
			return Specification.unrestricted();
		}
		String pattern = "%" + escapeLike(text.strip().toLowerCase(Locale.ROOT)) + "%";
		return (root, query, cb) -> cb.like(cb.lower(root.get("title")), pattern, LIKE_ESCAPE);
	}

	/** {@code %} and {@code _} typed by the user are literal characters, not wildcards. */
	private static String escapeLike(String text) {
		return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
	}

}
