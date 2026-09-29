package com.example.javaapi.todo;

/** How many subtasks a todo has and how many of them are done. */
record SubtaskCounts(Long todoId, long total, long completed) {

	static final SubtaskCounts NONE = new SubtaskCounts(null, 0, 0);

}
