package com.example.javaapi.outbox;

import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import tools.jackson.databind.json.JsonMapper;

/**
 * Records events in the {@code outbox_event} table; {@link OutboxRelay} publishes them later.
 * <p>
 * JDBC instead of a JPA entity: the outbox is written once and read by the relay with
 * {@code FOR UPDATE SKIP LOCKED}, which JPA cannot express. {@link JdbcClient} uses the connection of
 * the current JPA transaction, so the event is committed together with the entity changes.
 */
@Component
public class Outbox {

	private final JdbcClient jdbc;

	private final JsonMapper jsonMapper;

	Outbox(JdbcClient jdbc, JsonMapper jsonMapper) {
		this.jdbc = jdbc;
		this.jsonMapper = jsonMapper;
	}

	/**
	 * Adds an event to the caller's transaction. {@code MANDATORY}: without a transaction the event
	 * would be committed on its own, and the outbox would guarantee nothing, so that fails fast.
	 *
	 * @param aggregateType what the event is about, e.g. {@code Todo}
	 * @param aggregateId the ID of that entity
	 * @param eventType the routing key, e.g. {@code todo.completed}
	 * @param payload serialized to JSON as the message body
	 * @return the event ID, sent as the message ID
	 */
	@Transactional(propagation = Propagation.MANDATORY)
	public UUID record(String aggregateType, Object aggregateId, String eventType, Object payload) {
		UUID id = UUID.randomUUID();
		this.jdbc.sql("""
				INSERT INTO outbox_event (id, aggregate_type, aggregate_id, event_type, payload)
				VALUES (:id, :aggregateType, :aggregateId, :eventType, CAST(:payload AS jsonb))
				""")
			.param("id", id)
			.param("aggregateType", aggregateType)
			.param("aggregateId", aggregateId.toString())
			.param("eventType", eventType)
			.param("payload", this.jsonMapper.writeValueAsString(payload))
			.update();
		return id;
	}

}
