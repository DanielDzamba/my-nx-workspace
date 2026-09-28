package com.example.javaapi.todo;

import java.time.Instant;

/** A todo in the admin overview: like {@link TodoResponse}, plus who owns it. */
public record AdminTodoResponse(Long id, String title, boolean completed, Instant createdAt, String ownerId) {

	static AdminTodoResponse from(Todo todo) {
		return new AdminTodoResponse(todo.getId(), todo.getTitle(), todo.isCompleted(), todo.getCreatedAt(),
				todo.getOwnerId());
	}

}
