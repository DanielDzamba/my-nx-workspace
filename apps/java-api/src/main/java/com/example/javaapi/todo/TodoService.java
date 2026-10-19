package com.example.javaapi.todo;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.javaapi.api.model.AdminTodoResponse;
import com.example.javaapi.api.model.SubtaskRequest;
import com.example.javaapi.api.model.SubtaskResponse;
import com.example.javaapi.api.model.TodoDetailResponse;
import com.example.javaapi.api.model.TodoRequest;
import com.example.javaapi.api.model.TodoResponse;
import com.example.javaapi.api.model.TodoSummaryResponse;

/**
 * Every method works on the todos of one owner (the signed-in user). A todo of another user
 * answers 404 like a missing one, so the API does not reveal which IDs exist (IDOR protection).
 * <p>
 * Methods return DTOs, never entities: everything lazy is read here, inside the transaction.
 * With open-in-view off, touching a lazy relation later (in the controller or during JSON
 * serialization) would throw {@code LazyInitializationException}.
 */
@Service
@Transactional(readOnly = true)
public class TodoService {

	private final TodoRepository repository;

	private final SubtaskRepository subtaskRepository;

	TodoService(TodoRepository repository, SubtaskRepository subtaskRepository) {
		this.repository = repository;
		this.subtaskRepository = subtaskRepository;
	}

	/**
	 * One page of the owner's todos. Runs three queries however large the page is: the page, the
	 * total count (for {@code totalElements}) and the subtask counts of the todos on the page.
	 */
	public Page<TodoSummaryResponse> findPage(String ownerId, TodoStatus status, String titleQuery,
			Pageable pageable) {
		Specification<Todo> filter = TodoSpecifications.ownedBy(ownerId)
			.and(TodoSpecifications.hasStatus(status))
			.and(TodoSpecifications.titleContains(titleQuery));
		Page<Todo> page = this.repository.findAll(filter, TodoPaging.withStableSort(pageable));
		Map<Long, SubtaskCounts> counts = subtaskCounts(page.getContent());
		return page
			.map((todo) -> TodoMapper.toSummary(todo, counts.getOrDefault(todo.getId(), SubtaskCounts.NONE)));
	}

	public TodoDetailResponse findById(String ownerId, long id) {
		return this.repository.findWithSubtasksByIdAndOwnerId(id, ownerId)
			.map(TodoMapper::toDetail)
			.orElseThrow(() -> todoNotFound(id));
	}

	@Transactional
	public TodoResponse create(String ownerId, TodoRequest request) {
		Todo todo = new Todo(ownerId, request.getTitle().strip(), Boolean.TRUE.equals(request.getCompleted()));
		return TodoMapper.toResponse(this.repository.save(todo));
	}

	@Transactional
	public TodoResponse update(String ownerId, long id, TodoRequest request) {
		Todo todo = getTodo(ownerId, id);
		todo.setTitle(request.getTitle().strip());
		if (request.getCompleted() != null) {
			todo.setCompleted(request.getCompleted());
		}
		return TodoMapper.toResponse(todo);
	}

	@Transactional
	public void delete(String ownerId, long id) {
		// The database deletes the subtasks (ON DELETE CASCADE in V3)
		this.repository.delete(getTodo(ownerId, id));
	}

	@Transactional
	public SubtaskResponse addSubtask(String ownerId, long todoId, SubtaskRequest request) {
		Todo todo = getTodo(ownerId, todoId);
		Subtask subtask = new Subtask(todo, request.getTitle().strip(), Boolean.TRUE.equals(request.getCompleted()));
		return TodoMapper.toResponse(this.subtaskRepository.save(subtask));
	}

	@Transactional
	public SubtaskResponse updateSubtask(String ownerId, long todoId, long subtaskId, SubtaskRequest request) {
		Subtask subtask = getSubtask(ownerId, todoId, subtaskId);
		subtask.setTitle(request.getTitle().strip());
		if (request.getCompleted() != null) {
			subtask.setCompleted(request.getCompleted());
		}
		return TodoMapper.toResponse(subtask);
	}

	@Transactional
	public void deleteSubtask(String ownerId, long todoId, long subtaskId) {
		this.subtaskRepository.delete(getSubtask(ownerId, todoId, subtaskId));
	}

	/** One page of all users' todos, for the admin overview. */
	public Page<AdminTodoResponse> findAllOwners(Pageable pageable) {
		return this.repository.findAll(TodoPaging.withStableSort(pageable)).map(TodoMapper::toAdmin);
	}

	private Map<Long, SubtaskCounts> subtaskCounts(List<Todo> todos) {
		if (todos.isEmpty()) {
			return Map.of();
		}
		List<Long> ids = todos.stream().map(Todo::getId).toList();
		return this.subtaskRepository.countByTodoIds(ids)
			.stream()
			.collect(Collectors.toMap(SubtaskCounts::todoId, Function.identity()));
	}

	private Todo getTodo(String ownerId, long id) {
		return this.repository.findByIdAndOwnerId(id, ownerId).orElseThrow(() -> todoNotFound(id));
	}

	private Subtask getSubtask(String ownerId, long todoId, long subtaskId) {
		return this.subtaskRepository.findByIdAndTodoIdAndTodoOwnerId(subtaskId, todoId, ownerId)
			.orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
					"Subtask " + subtaskId + " of todo " + todoId + " not found"));
	}

	private static ResponseStatusException todoNotFound(long id) {
		return new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo " + id + " not found");
	}

}
