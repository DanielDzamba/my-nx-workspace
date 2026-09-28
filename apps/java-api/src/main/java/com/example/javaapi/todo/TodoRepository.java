package com.example.javaapi.todo;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * User-facing queries always include the owner, so a todo of another user is simply not found
 * (no separate ownership check that could be forgotten).
 */
public interface TodoRepository extends JpaRepository<Todo, Long> {

	List<Todo> findAllByOwnerIdOrderByCreatedAtAscIdAsc(String ownerId);

	Optional<Todo> findByIdAndOwnerId(long id, String ownerId);

	/** All users' todos, for admins only. */
	List<Todo> findAllByOrderByCreatedAtAscIdAsc();

}
