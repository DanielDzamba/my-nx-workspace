package com.example.javaapi.notification;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

	/**
	 * Stores a notification unless one for this event exists already. The check and the insert are
	 * one atomic statement on the unique {@code event_id}, so even two deliveries of the same event
	 * processed at the same moment create only one row (a separate {@code exists} query would not).
	 *
	 * @return 1 if inserted, 0 if the event was processed before
	 */
	@Modifying
	@Query(nativeQuery = true, value = """
			INSERT INTO notification (event_id, recipient_id, type, todo_id, todo_title)
			VALUES (:eventId, :recipientId, :type, :todoId, :todoTitle)
			ON CONFLICT (event_id) DO NOTHING
			""")
	int insertOnce(UUID eventId, String recipientId, String type, long todoId, String todoTitle);

	List<Notification> findTop20ByRecipientIdOrderByCreatedAtDescIdDesc(String recipientId);

	long countByRecipientIdAndReadAtIsNull(String recipientId);

	@Modifying
	@Query("UPDATE Notification n SET n.readAt = CURRENT_TIMESTAMP WHERE n.recipientId = :recipientId AND n.readAt IS NULL")
	int markAllRead(String recipientId);

}
