package com.example.javaapi.todo;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body of POST and PUT. On create, a missing {@code completed} means {@code false};
 * on update, it keeps the current value.
 */
public record TodoRequest(@NotBlank @Size(max = 200) String title, Boolean completed) {

}
