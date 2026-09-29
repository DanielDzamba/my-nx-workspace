package com.example.javaapi.todo;

import java.time.Instant;

/** A todo in the paged list: like {@link TodoResponse}, plus how far its subtasks are. */
public record TodoSummaryResponse(Long id, String title, boolean completed, Instant createdAt, long subtaskCount,
		long completedSubtaskCount) {

	static TodoSummaryResponse from(Todo todo, SubtaskCounts counts) {
		return new TodoSummaryResponse(todo.getId(), todo.getTitle(), todo.isCompleted(), todo.getCreatedAt(),
				counts.total(), counts.completed());
	}

}
