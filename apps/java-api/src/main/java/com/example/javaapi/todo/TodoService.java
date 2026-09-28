package com.example.javaapi.todo;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Every method works on the todos of one owner (the signed-in user). A todo of another user
 * answers 404 like a missing one, so the API does not reveal which IDs exist (IDOR protection).
 */
@Service
@Transactional(readOnly = true)
public class TodoService {

	private final TodoRepository repository;

	TodoService(TodoRepository repository) {
		this.repository = repository;
	}

	public List<TodoResponse> findAll(String ownerId) {
		return this.repository.findAllByOwnerIdOrderByCreatedAtAscIdAsc(ownerId)
			.stream()
			.map(TodoResponse::from)
			.toList();
	}

	public TodoResponse findById(String ownerId, long id) {
		return TodoResponse.from(getTodo(ownerId, id));
	}

	@Transactional
	public TodoResponse create(String ownerId, TodoRequest request) {
		Todo todo = new Todo(ownerId, request.title().strip(), Boolean.TRUE.equals(request.completed()));
		return TodoResponse.from(this.repository.save(todo));
	}

	@Transactional
	public TodoResponse update(String ownerId, long id, TodoRequest request) {
		Todo todo = getTodo(ownerId, id);
		todo.setTitle(request.title().strip());
		if (request.completed() != null) {
			todo.setCompleted(request.completed());
		}
		return TodoResponse.from(todo);
	}

	@Transactional
	public void delete(String ownerId, long id) {
		this.repository.delete(getTodo(ownerId, id));
	}

	/** Todos of all users, for the admin overview. */
	public List<AdminTodoResponse> findAllOwners() {
		return this.repository.findAllByOrderByCreatedAtAscIdAsc().stream().map(AdminTodoResponse::from).toList();
	}

	private Todo getTodo(String ownerId, long id) {
		return this.repository.findByIdAndOwnerId(id, ownerId)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo " + id + " not found"));
	}

}
