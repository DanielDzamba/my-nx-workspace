package com.example.javaapi.todo;

import java.net.URI;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import com.example.javaapi.api.TodosApi;
import com.example.javaapi.api.model.SubtaskRequest;
import com.example.javaapi.api.model.SubtaskResponse;
import com.example.javaapi.api.model.TodoDetailResponse;
import com.example.javaapi.api.model.TodoRequest;
import com.example.javaapi.api.model.TodoResponse;
import com.example.javaapi.api.model.TodoSummaryPage;
import com.example.javaapi.api.model.TodoSummaryResponse;
import com.example.javaapi.config.CurrentUser;

/**
 * Todos of the signed-in user. The owner always comes from the validated token ({@code sub}),
 * never from the request, so a client cannot act on behalf of another user.
 * <p>
 * Paths, parameters, validation and the JSON types come from {@link TodosApi}, which is generated
 * from {@code api-contract/openapi.yaml}; this class only implements it.
 */
@RestController
public class TodoController implements TodosApi {

	private final TodoService service;

	TodoController(TodoService service) {
		this.service = service;
	}

	/**
	 * One page of todos, e.g. {@code ?status=active&q=milk&page=0&size=10&sort=title,asc}.
	 * Spring binds {@code page}, {@code size} and {@code sort} into the {@link Pageable} (defaults
	 * from the contract); the page size is capped by {@code spring.data.web.pageable.max-page-size}.
	 */
	@Override
	public ResponseEntity<TodoSummaryPage> listTodos(String status, String q, Pageable pageable) {
		Page<TodoSummaryResponse> page = this.service.findPage(CurrentUser.id(), TodoStatus.fromParam(status), q,
				pageable);
		return ResponseEntity.ok(new TodoSummaryPage(page.getContent(), TodoMapper.toPageMetadata(page)));
	}

	@Override
	public ResponseEntity<TodoDetailResponse> getTodo(Long id) {
		return ResponseEntity.ok(this.service.findById(CurrentUser.id(), id));
	}

	@Override
	public ResponseEntity<TodoResponse> createTodo(TodoRequest request) {
		TodoResponse created = this.service.create(CurrentUser.id(), request);
		return ResponseEntity.created(URI.create("/api/todos/" + created.getId())).body(created);
	}

	@Override
	public ResponseEntity<TodoResponse> updateTodo(Long id, TodoRequest request) {
		return ResponseEntity.ok(this.service.update(CurrentUser.id(), id, request));
	}

	@Override
	public ResponseEntity<Void> deleteTodo(Long id) {
		this.service.delete(CurrentUser.id(), id);
		return ResponseEntity.noContent().build();
	}

	@Override
	public ResponseEntity<SubtaskResponse> createSubtask(Long id, SubtaskRequest request) {
		SubtaskResponse created = this.service.addSubtask(CurrentUser.id(), id, request);
		return ResponseEntity.created(URI.create("/api/todos/" + id + "/subtasks/" + created.getId()))
			.body(created);
	}

	@Override
	public ResponseEntity<SubtaskResponse> updateSubtask(Long id, Long subtaskId, SubtaskRequest request) {
		return ResponseEntity.ok(this.service.updateSubtask(CurrentUser.id(), id, subtaskId, request));
	}

	@Override
	public ResponseEntity<Void> deleteSubtask(Long id, Long subtaskId) {
		this.service.deleteSubtask(CurrentUser.id(), id, subtaskId);
		return ResponseEntity.noContent().build();
	}

}
