package com.example.javaapi.todo;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class TodoService {

	private final TodoRepository repository;

	TodoService(TodoRepository repository) {
		this.repository = repository;
	}

	public List<TodoResponse> findAll() {
		return this.repository.findAllByOrderByCreatedAtAscIdAsc().stream().map(TodoResponse::from).toList();
	}

	public TodoResponse findById(long id) {
		return TodoResponse.from(getTodo(id));
	}

	@Transactional
	public TodoResponse create(TodoRequest request) {
		Todo todo = new Todo(request.title().strip(), Boolean.TRUE.equals(request.completed()));
		return TodoResponse.from(this.repository.save(todo));
	}

	@Transactional
	public TodoResponse update(long id, TodoRequest request) {
		Todo todo = getTodo(id);
		todo.setTitle(request.title().strip());
		if (request.completed() != null) {
			todo.setCompleted(request.completed());
		}
		return TodoResponse.from(todo);
	}

	@Transactional
	public void delete(long id) {
		this.repository.delete(getTodo(id));
	}

	private Todo getTodo(long id) {
		return this.repository.findById(id)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo " + id + " not found"));
	}

}
