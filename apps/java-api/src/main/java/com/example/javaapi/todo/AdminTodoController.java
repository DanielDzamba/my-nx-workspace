package com.example.javaapi.todo;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

import com.example.javaapi.api.AdminApi;
import com.example.javaapi.api.model.AdminTodoPage;
import com.example.javaapi.api.model.AdminTodoResponse;

/**
 * Read-only overview of all users' todos. Without a token the request ends with 401 in the
 * security filter chain; with a token but without the ADMIN role, {@code @PreAuthorize} answers 403.
 */
@RestController
@PreAuthorize("hasRole('ADMIN')")
public class AdminTodoController implements AdminApi {

	private final TodoService service;

	AdminTodoController(TodoService service) {
		this.service = service;
	}

	/** One page of all users' todos, newest first; same paging parameters as {@code /api/todos}. */
	@Override
	public ResponseEntity<AdminTodoPage> listAllTodos(Pageable pageable) {
		Page<AdminTodoResponse> page = this.service.findAllOwners(pageable);
		return ResponseEntity.ok(new AdminTodoPage(page.getContent(), TodoMapper.toPageMetadata(page)));
	}

}
