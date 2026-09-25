package com.example.javaapi.hello;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/hello")
public class HelloController {

	@GetMapping
	public Map<String, String> hello(@RequestParam(defaultValue = "world") String name) {
		return Map.of("message", "Hello, " + name + "!");
	}

}
