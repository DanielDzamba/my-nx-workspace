package com.example.javaapi.todo;

import java.net.URI;
import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/todos")
public class TodoController {

	private final TodoService service;

	TodoController(TodoService service) {
		this.service = service;
	}

	@GetMapping
	public List<TodoResponse> list() {
		return this.service.findAll();
	}

	@GetMapping("/{id}")
	public TodoResponse get(@PathVariable long id) {
		return this.service.findById(id);
	}

	@PostMapping
	public ResponseEntity<TodoResponse> create(@Valid @RequestBody TodoRequest request) {
		TodoResponse created = this.service.create(request);
		return ResponseEntity.created(URI.create("/api/todos/" + created.id())).body(created);
	}

	@PutMapping("/{id}")
	public TodoResponse update(@PathVariable long id, @Valid @RequestBody TodoRequest request) {
		return this.service.update(id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable long id) {
		this.service.delete(id);
	}

}
