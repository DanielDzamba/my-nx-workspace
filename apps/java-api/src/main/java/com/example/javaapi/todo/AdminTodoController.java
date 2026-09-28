package com.example.javaapi.todo;

import java.util.List;

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

	@GetMapping
	public List<AdminTodoResponse> list() {
		return this.service.findAllOwners();
	}

}
