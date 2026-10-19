package com.example.javaapi.notification;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import com.example.javaapi.api.NotificationsApi;
import com.example.javaapi.api.model.NotificationList;
import com.example.javaapi.config.CurrentUser;

/** Notifications of the signed-in user; they are created by {@link TodoCompletedListener}. */
@RestController
public class NotificationController implements NotificationsApi {

	private final NotificationService service;

	NotificationController(NotificationService service) {
		this.service = service;
	}

	@Override
	public ResponseEntity<NotificationList> listNotifications() {
		return ResponseEntity.ok(this.service.findLatest(CurrentUser.id()));
	}

	@Override
	public ResponseEntity<Void> markAllNotificationsRead() {
		this.service.markAllRead(CurrentUser.id());
		return ResponseEntity.noContent().build();
	}

}
