package com.example.javaapi.user;

import java.util.Objects;

/**
 * What a request needs to know about its user; the value stored in the {@code users} cache. A
 * plain record instead of the entity: it is serialized to JSON in Redis, and an entity would bring
 * Hibernate state (proxies, lazy fields) along.
 */
public record UserProfile(String id, String name, String email, boolean blocked) {

	static UserProfile of(User user) {
		return new UserProfile(user.getId(), user.getName(), user.getEmail(), user.isBlocked());
	}

	/**
	 * Whether the token says something new about the user. A missing claim ({@code null}) is not a
	 * change: {@link UserRepository#upsert} would keep the stored value anyway.
	 */
	boolean differsFrom(String tokenName, String tokenEmail) {
		return (tokenName != null && !Objects.equals(tokenName, this.name))
				|| (tokenEmail != null && !Objects.equals(tokenEmail, this.email));
	}

}
