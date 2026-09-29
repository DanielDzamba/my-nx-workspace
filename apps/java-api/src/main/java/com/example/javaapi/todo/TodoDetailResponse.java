package com.example.javaapi.todo;

import java.time.Instant;
import java.util.List;

/** One todo with its subtasks, for the detail page. */
public record TodoDetailResponse(Long id, String title, boolean completed, Instant createdAt,
		List<SubtaskResponse> subtasks) {

	/** Reads the lazy {@code subtasks} collection, so call it inside the transaction. */
	static TodoDetailResponse from(Todo todo) {
		return new TodoDetailResponse(todo.getId(), todo.getTitle(), todo.isCompleted(), todo.getCreatedAt(),
				todo.getSubtasks().stream().map(SubtaskResponse::from).toList());
	}

}
