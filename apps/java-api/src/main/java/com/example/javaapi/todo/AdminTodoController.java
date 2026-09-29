package com.example.javaapi.todo;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.web.PagedModel;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only overview of all users' todos. Without a token the request ends with 401 in the
 * security filter chain; with a token but without the ADMIN role, {@code @PreAuthorize} answers 403.
 */
@RestController
@RequestMapping("/api/admin/todos")
@PreAuthorize("hasRole('ADMIN')")
public class AdminTodoController {

	private final TodoService service;

	AdminTodoController(TodoService service) {
		this.service = service;
	}

	/** One page of all users' todos, newest first; same paging parameters as {@code /api/todos}. */
	@GetMapping
	public PagedModel<AdminTodoResponse> list(
			@PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
		return new PagedModel<>(this.service.findAllOwners(pageable));
	}

}
