package com.example.javaapi.user;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

import com.example.javaapi.api.UsersApi;
import com.example.javaapi.api.model.PageMetadata;
import com.example.javaapi.api.model.UserBlockedRequest;
import com.example.javaapi.api.model.UserPage;
import com.example.javaapi.api.model.UserResponse;
import com.example.javaapi.config.CurrentUser;

/** The users who have signed in, for admins: list them and block or unblock them. */
@RestController
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController implements UsersApi {

	private final UserService service;

	AdminUserController(UserService service) {
		this.service = service;
	}

	@Override
	public ResponseEntity<UserPage> listUsers(Pageable pageable) {
		Page<UserResponse> page = this.service.findPage(pageable);
		return ResponseEntity.ok(new UserPage(page.getContent(), new PageMetadata(page.getSize(), page.getNumber(),
				page.getTotalElements(), page.getTotalPages())));
	}

	@Override
	public ResponseEntity<UserResponse> setUserBlocked(String userId, UserBlockedRequest request) {
		return ResponseEntity.ok(this.service.setBlocked(CurrentUser.id(), userId, request.getBlocked()));
	}

}
