package com.example.javaapi.todo;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

@Entity
@Table(name = "todo")
public class Todo {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, length = 200)
	private String title;

	@Column(nullable = false)
	private boolean completed;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	/** Auth0 user ID ({@code sub} claim) of the user who created the todo. */
	@Column(name = "owner_id", nullable = false, updatable = false)
	private String ownerId;

	/**
	 * Read-only side of the relation ({@link Subtask#getTodo()} owns the foreign key). Collections
	 * are LAZY: loaded by an extra query on first access, which needs an open session, i.e. a
	 * transaction (open-in-view is off). Fetch them explicitly where they are needed
	 * ({@link TodoRepository#findWithSubtasksByIdAndOwnerId}).
	 */
	@OneToMany(mappedBy = "todo")
	@OrderBy("createdAt ASC, id ASC")
	private List<Subtask> subtasks = new ArrayList<>();

	protected Todo() {
	}

	public Todo(String ownerId, String title, boolean completed) {
		this.ownerId = ownerId;
		this.title = title;
		this.completed = completed;
		this.createdAt = Instant.now();
	}

	public Long getId() {
		return this.id;
	}

	public String getTitle() {
		return this.title;
	}

	public void setTitle(String title) {
		this.title = title;
	}

	public boolean isCompleted() {
		return this.completed;
	}

	public void setCompleted(boolean completed) {
		this.completed = completed;
	}

	public Instant getCreatedAt() {
		return this.createdAt;
	}

	public String getOwnerId() {
		return this.ownerId;
	}

	public List<Subtask> getSubtasks() {
		return this.subtasks;
	}

}
