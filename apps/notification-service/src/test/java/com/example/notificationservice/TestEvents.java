package com.example.notificationservice;

import java.util.UUID;

import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageProperties;

import tools.jackson.databind.json.JsonMapper;

/** Messages shaped like the ones java-api's outbox relay publishes: JSON body, event ID as message ID. */
public final class TestEvents {

	private TestEvents() {
	}

	public static Message message(JsonMapper jsonMapper, UUID eventId, Object event) {
		return MessageBuilder.withBody(jsonMapper.writeValueAsBytes(event))
			.setContentType(MessageProperties.CONTENT_TYPE_JSON)
			.setMessageId(eventId.toString())
			.build();
	}

}
