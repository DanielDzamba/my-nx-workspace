package com.example.javaapi.hello;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

import com.example.javaapi.api.HelloApi;
import com.example.javaapi.api.model.HelloResponse;

@RestController
public class HelloController implements HelloApi {

	@Override
	public ResponseEntity<HelloResponse> hello(String name) {
		return ResponseEntity.ok(new HelloResponse("Hello, " + name + "!"));
	}

}
