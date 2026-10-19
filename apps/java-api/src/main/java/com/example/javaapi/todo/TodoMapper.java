package com.example.javaapi.todo;

import org.springframework.data.domain.Page;

import com.example.javaapi.api.model.AdminTodoResponse;
import com.example.javaapi.api.model.PageMetadata;
import com.example.javaapi.api.model.SubtaskResponse;
import com.example.javaapi.api.model.TodoDetailResponse;
import com.example.javaapi.api.model.TodoResponse;
import com.example.javaapi.api.model.TodoSummaryResponse;

/**
 * Entities to the response DTOs generated from {@code api-contract/openapi.yaml}. The entities never
 * leave the service, so the JSON shape is decided by the contract, not by the database model.
 */
final class TodoMapper {

	private TodoMapper() {
	}

	static TodoResponse toResponse(Todo todo) {
		return new TodoResponse(todo.getId(), todo.getTitle(), todo.isCompleted(), todo.getCreatedAt());
	}

	static TodoSummaryResponse toSummary(Todo todo, SubtaskCounts counts) {
		return new TodoSummaryResponse(todo.getId(), todo.getTitle(), todo.isCompleted(), todo.getCreatedAt(),
				counts.total(), counts.completed());
	}

	/** Reads the lazy {@code subtasks} collection, so call it inside the transaction. */
	static TodoDetailResponse toDetail(Todo todo) {
		return new TodoDetailResponse(todo.getId(), todo.getTitle(), todo.isCompleted(), todo.getCreatedAt(),
				todo.getSubtasks().stream().map(TodoMapper::toResponse).toList());
	}

	static AdminTodoResponse toAdmin(Todo todo) {
		return new AdminTodoResponse(todo.getId(), todo.getTitle(), todo.isCompleted(), todo.getCreatedAt(),
				todo.getOwnerId());
	}

	static SubtaskResponse toResponse(Subtask subtask) {
		return new SubtaskResponse(subtask.getId(), subtask.getTitle(), subtask.isCompleted(),
				subtask.getCreatedAt());
	}

	/** The {@code page} part of a paged response: {@code {"size", "number", "totalElements", "totalPages"}}. */
	static PageMetadata toPageMetadata(Page<?> page) {
		return new PageMetadata(page.getSize(), page.getNumber(), page.getTotalElements(), page.getTotalPages());
	}

}
