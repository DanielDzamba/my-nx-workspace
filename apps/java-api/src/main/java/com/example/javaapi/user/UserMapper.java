package com.example.javaapi.user;

import com.example.javaapi.api.model.UserResponse;

/** {@link User} to the response DTO generated from {@code api-contract/openapi.yaml}. */
final class UserMapper {

	private UserMapper() {
	}

	static UserResponse toResponse(User user) {
		return new UserResponse(user.getId(), user.isBlocked(), user.getCreatedAt()).name(user.getName())
			.email(user.getEmail());
	}

}
