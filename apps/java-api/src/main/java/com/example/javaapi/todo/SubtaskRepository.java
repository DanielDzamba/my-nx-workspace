package com.example.javaapi.todo;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface SubtaskRepository extends JpaRepository<Subtask, Long> {

	/** A subtask only through its todo and that todo's owner, like {@link TodoRepository#findByIdAndOwnerId}. */
	Optional<Subtask> findByIdAndTodoIdAndTodoOwnerId(long id, long todoId, String ownerId);

	/**
	 * Subtask counts of many todos in one query. The todo list uses this instead of
	 * {@code todo.getSubtasks().size()} per todo, which would be the N+1 problem
	 * (1 query for the page + 1 query per todo on it).
	 */
	@Query("""
			select new com.example.javaapi.todo.SubtaskCounts(
				s.todo.id, count(s), sum(case when s.completed then 1 else 0 end))
			from Subtask s
			where s.todo.id in :todoIds
			group by s.todo.id""")
	List<SubtaskCounts> countByTodoIds(Collection<Long> todoIds);

}
