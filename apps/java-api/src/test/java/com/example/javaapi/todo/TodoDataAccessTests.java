package com.example.javaapi.todo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import jakarta.persistence.EntityManagerFactory;

import org.hibernate.LazyInitializationException;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.junit.jupiter.Testcontainers;

import com.example.javaapi.TestcontainersConfiguration;

/**
 * How the todo queries hit the database: number of SQL statements (N+1), lazy loading without
 * open-in-view, and whether PostgreSQL can use the indexes (EXPLAIN).
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Import(TestcontainersConfiguration.class)
@Testcontainers(disabledWithoutDocker = true)
class TodoDataAccessTests {

	private static final String ALICE = "auth0|alice";

	@Autowired
	private TodoService service;

	@Autowired
	private TodoRepository repository;

	@Autowired
	private SubtaskRepository subtaskRepository;

	@Autowired
	private JdbcTemplate jdbc;

	@Autowired
	private TransactionTemplate transaction;

	private Statistics statistics;

	@BeforeEach
	void setUp(@Autowired EntityManagerFactory entityManagerFactory) {
		this.repository.deleteAll();
		this.statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
	}

	private void saveTodosWithSubtasks(int count) {
		for (int i = 0; i < count; i++) {
			Todo todo = this.repository.save(new Todo(ALICE, "Todo " + i, false));
			this.subtaskRepository.save(new Subtask(todo, "Step 1", true));
			this.subtaskRepository.save(new Subtask(todo, "Step 2", false));
		}
	}

	@Test
	void listPageNeedsThreeQueriesWhateverItsSize() {
		saveTodosWithSubtasks(10);
		this.statistics.clear();

		var page = this.service.findPage(ALICE, TodoStatus.ALL, null, PageRequest.of(0, 10));

		assertThat(page.getContent()).hasSize(10).allSatisfy((todo) -> assertThat(todo.subtaskCount()).isEqualTo(2));
		// Page + count + subtask counts. Reading todo.getSubtasks().size() per todo instead would be
		// 1 + 1 + 10 statements here: the N+1 problem, growing with the page size.
		assertThat(this.statistics.getPrepareStatementCount()).isEqualTo(3);
	}

	@Test
	void detailLoadsTodoAndSubtasksInOneQuery() {
		saveTodosWithSubtasks(1);
		long id = this.repository.findAll().get(0).getId();
		this.statistics.clear();

		TodoDetailResponse detail = this.service.findById(ALICE, id);

		assertThat(detail.subtasks()).extracting(SubtaskResponse::title).containsExactly("Step 1", "Step 2");
		// @EntityGraph turns the lazy collection into a LEFT JOIN FETCH
		assertThat(this.statistics.getPrepareStatementCount()).isEqualTo(1);
	}

	@Test
	void lazySubtasksCannotBeReadOutsideATransaction() {
		saveTodosWithSubtasks(1);

		// The repository call runs in its own transaction; the session closes when it returns.
		// With open-in-view on, the session would stay open until the end of the web request and
		// this would silently run one more query (and hold the DB connection meanwhile).
		Todo todo = this.repository.findAll().get(0);

		assertThatThrownBy(() -> todo.getSubtasks().size()).isInstanceOf(LazyInitializationException.class);
	}

	@Test
	void titleSearchCanUseTheTrigramIndex() {
		// Without the owner condition: together with it, on a table this small the planner rightly
		// uses only the owner index and filters that user's rows (see docs/java-api/data-access.md)
		List<String> plan = explainWithoutSeqScan("SELECT * FROM todo WHERE lower(title) LIKE '%milk%'");

		assertThat(String.join("\n", plan)).contains("todo_title_trgm_idx");
	}

	@Test
	void ownerListCanUseTheOwnerIndex() {
		List<String> plan = explainWithoutSeqScan(
				"SELECT * FROM todo WHERE owner_id = 'auth0|alice' ORDER BY created_at DESC, id DESC LIMIT 10");

		assertThat(String.join("\n", plan)).contains("todo_owner_created_idx");
	}

	/**
	 * EXPLAIN shows the plan PostgreSQL picked. On a tiny test table a Seq Scan is always cheapest,
	 * so the test turns it off to check that an index <em>can</em> serve the query at all.
	 * {@code SET LOCAL} only lasts until the end of the transaction.
	 */
	private List<String> explainWithoutSeqScan(String sql) {
		return this.transaction.execute((status) -> {
			this.jdbc.execute("SET LOCAL enable_seqscan = off");
			return this.jdbc.queryForList("EXPLAIN " + sql, String.class);
		});
	}

}
