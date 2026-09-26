package com.example.javaapi.todo;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
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

	protected Todo() {
	}

	public Todo(String title, boolean completed) {
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

}
