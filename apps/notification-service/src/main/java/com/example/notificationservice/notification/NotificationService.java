package com.example.notificationservice.notification;

import java.time.ZoneOffset;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.notificationservice.api.model.NotificationList;
import com.example.notificationservice.api.model.NotificationResponse;

/** Notifications of one recipient (the signed-in user). */
@Service
@Transactional(readOnly = true)
public class NotificationService {

	private final NotificationRepository repository;

	NotificationService(NotificationRepository repository) {
		this.repository = repository;
	}

	public NotificationList findLatest(String recipientId) {
		return new NotificationList(
				this.repository.findTop20ByRecipientIdOrderByCreatedAtDescIdDesc(recipientId)
					.stream()
					.map(NotificationService::toResponse)
					.toList(),
				this.repository.countByRecipientIdAndReadAtIsNull(recipientId));
	}

	@Transactional
	public void markAllRead(String recipientId) {
		this.repository.markAllRead(recipientId);
	}

	private static NotificationResponse toResponse(Notification notification) {
		return new NotificationResponse(notification.getId(),
				NotificationResponse.TypeEnum.fromValue(notification.getType()), notification.getTodoId(),
				notification.getTodoTitle(), notification.getCreatedAt(), notification.isRead());
	}

}
