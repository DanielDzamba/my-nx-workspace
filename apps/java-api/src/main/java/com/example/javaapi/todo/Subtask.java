package com.example.javaapi.todo;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "subtask")
public class Subtask {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	/**
	 * LAZY: {@code @ManyToOne} is EAGER by default, which would load the todo with every subtask
	 * (and silently add a query per subtask when the todo is not in the persistence context).
	 */
	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "todo_id", nullable = false, updatable = false)
	private Todo todo;

	@Column(nullable = false, length = 200)
	private String title;

	@Column(nullable = false)
	private boolean completed;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt;

	protected Subtask() {
	}

	public Subtask(Todo todo, String title, boolean completed) {
		this.todo = todo;
		this.title = title;
		this.completed = completed;
		this.createdAt = Instant.now();
	}

	public Long getId() {
		return this.id;
	}

	public Todo getTodo() {
		return this.todo;
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

}
