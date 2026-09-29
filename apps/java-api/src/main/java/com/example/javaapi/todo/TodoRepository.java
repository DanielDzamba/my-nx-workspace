package com.example.javaapi.todo;

import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/**
 * User-facing queries always include the owner, so a todo of another user is simply not found
 * (no separate ownership check that could be forgotten). The paged list is built from
 * {@link TodoSpecifications} via {@link JpaSpecificationExecutor}.
 */
public interface TodoRepository extends JpaRepository<Todo, Long>, JpaSpecificationExecutor<Todo> {

	Optional<Todo> findByIdAndOwnerId(long id, String ownerId);

	/**
	 * Like {@link #findByIdAndOwnerId}, but loads the subtasks in the same query (LEFT JOIN FETCH)
	 * instead of a second query on first access.
	 */
	@EntityGraph(attributePaths = "subtasks")
	Optional<Todo> findWithSubtasksByIdAndOwnerId(long id, String ownerId);

}
