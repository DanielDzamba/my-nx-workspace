package com.example.javaapi.todo;

import java.net.URI;

import jakarta.validation.Valid;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.web.PagedModel;
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
import org.springframework.web.bind.annotation.RequestParam;
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

	/**
	 * One page of todos, e.g. {@code ?status=active&q=milk&page=0&size=10&sort=title,asc}.
	 * Spring binds {@code page}, {@code size} and {@code sort} into the {@link Pageable}; the page
	 * size is capped by {@code spring.data.web.pageable.max-page-size}. {@link PagedModel} is the
	 * stable JSON shape of a page: {@code {"content": [...], "page": {"size", "number",
	 * "totalElements", "totalPages"}}}.
	 */
	@GetMapping
	public PagedModel<TodoSummaryResponse> list(@AuthenticationPrincipal Jwt jwt,
			@RequestParam(defaultValue = "all") String status, @RequestParam(required = false) String q,
			@PageableDefault(size = 10, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
		return new PagedModel<>(
				this.service.findPage(jwt.getSubject(), TodoStatus.fromParam(status), q, pageable));
	}

	@GetMapping("/{id}")
	public TodoDetailResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable long id) {
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

	@PostMapping("/{id}/subtasks")
	public ResponseEntity<SubtaskResponse> createSubtask(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
			@Valid @RequestBody SubtaskRequest request) {
		SubtaskResponse created = this.service.addSubtask(jwt.getSubject(), id, request);
		return ResponseEntity.created(URI.create("/api/todos/" + id + "/subtasks/" + created.id())).body(created);
	}

	@PutMapping("/{id}/subtasks/{subtaskId}")
	public SubtaskResponse updateSubtask(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
			@PathVariable long subtaskId, @Valid @RequestBody SubtaskRequest request) {
		return this.service.updateSubtask(jwt.getSubject(), id, subtaskId, request);
	}

	@DeleteMapping("/{id}/subtasks/{subtaskId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteSubtask(@AuthenticationPrincipal Jwt jwt, @PathVariable long id,
			@PathVariable long subtaskId) {
		this.service.deleteSubtask(jwt.getSubject(), id, subtaskId);
	}

}
