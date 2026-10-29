package com.example.notificationservice.notification;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * An in-app notification for one user. Read-only for JPA: rows are inserted by
 * {@link NotificationRepository#insertOnce} (idempotent) and marked as read in bulk.
 */
@Entity
@Table(name = "notification")
public class Notification {

	@Id
	private Long id;

	/** Auth0 user ID of the user who sees it. */
	@Column(name = "recipient_id", nullable = false)
	private String recipientId;

	@Column(nullable = false)
	private String type;

	@Column(name = "todo_id", nullable = false)
	private long todoId;

	@Column(name = "todo_title", nullable = false)
	private String todoTitle;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	/** {@code null} while unread. */
	@Column(name = "read_at")
	private Instant readAt;

	protected Notification() {
	}

	public Long getId() {
		return this.id;
	}

	public String getRecipientId() {
		return this.recipientId;
	}

	public String getType() {
		return this.type;
	}

	public long getTodoId() {
		return this.todoId;
	}

	public String getTodoTitle() {
		return this.todoTitle;
	}

	public Instant getCreatedAt() {
		return this.createdAt;
	}

	public boolean isRead() {
		return this.readAt != null;
	}

}
