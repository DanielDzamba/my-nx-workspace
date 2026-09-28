package com.example.javaapi.todo;

import java.net.URI;
import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Todos of the signed-in user. The owner always comes from the validated token ({@code sub}),
 * never from the request, so a client cannot act on behalf of another user.
 */
@RestController
@RequestMapping("/api/todos")
public class TodoController {

	private final TodoService service;

	TodoController(TodoService service) {
		this.service = service;
	}

	@GetMapping
	public List<TodoResponse> list(@AuthenticationPrincipal Jwt jwt) {
		return this.service.findAll(jwt.getSubject());
	}

	@GetMapping("/{id}")
	public TodoResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
		return this.service.findById(jwt.getSubject(), id);
	}

	@PostMapping
	public ResponseEntity<TodoResponse> create(@AuthenticationPrincipal Jwt jwt,
			@Valid @RequestBody TodoRequest request) {
		TodoResponse created = this.service.create(jwt.getSubject(), request);
		return ResponseEntity.created(URI.create("/api/todos/" + created.id())).body(created);
	}

	@PutMapping("/{id}")
	public TodoResponse update(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
			@Valid @RequestBody TodoRequest request) {
		return this.service.update(jwt.getSubject(), id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
		this.service.delete(jwt.getSubject(), id);
	}

}
