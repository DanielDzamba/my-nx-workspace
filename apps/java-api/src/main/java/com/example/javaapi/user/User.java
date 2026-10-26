package com.example.javaapi.user;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A user who has signed in. Rows are created and updated by {@link UserRepository#upsert}, so the
 * entity has no public constructor; tests create rows the same way.
 */
@Entity
@Table(name = "users")
public class User {

	/** Auth0 user ID: the {@code sub} claim of the access token. */
	@Id
	private String id;

	private String name;

	private String email;

	@Column(nullable = false)
	private boolean blocked;

	@Column(name = "created_at", nullable = false, insertable = false, updatable = false)
	private Instant createdAt;

	protected User() {
	}

	public String getId() {
		return this.id;
	}

	public String getName() {
		return this.name;
	}

	public String getEmail() {
		return this.email;
	}

	public boolean isBlocked() {
		return this.blocked;
	}

	public void setBlocked(boolean blocked) {
		this.blocked = blocked;
	}

	public Instant getCreatedAt() {
		return this.createdAt;
	}

}
